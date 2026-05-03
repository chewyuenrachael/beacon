import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DhvcCandidate, DhvcSourceUrl } from "@/lib/types";

vi.mock("@/lib/observations", () => ({
  logObservation: vi.fn().mockResolvedValue({
    id: "obs-mock",
    entity_type: "dhvc_candidate",
    entity_id: "mock-id",
    observation_type: "dhvc_candidate_scored",
    payload: {},
    source: "manual",
    confidence: 0.7,
    observed_at: "",
    created_at: "",
  }),
}));

import { logObservation } from "@/lib/observations";
import {
  computeDhvcScoreFromCandidate,
  scoreDhvcCandidate,
} from "@/lib/dhvc-scoring";

function sourceUrl(
  partial: Omit<DhvcSourceUrl, "url" | "observed_at"> & {
    url?: string;
    observed_at?: string;
  }
): DhvcSourceUrl {
  return {
    url: partial.url ?? "https://example.com/p",
    observed_at: partial.observed_at ?? "2026-04-01T00:00:00.000Z",
    source: partial.source,
    description: partial.description,
  };
}

const baseCandidate: Pick<
  DhvcCandidate,
  | "institution_id"
  | "graduation_year"
  | "github_username"
  | "twitter_handle"
  | "source_urls"
> = {
  institution_id: "mit",
  graduation_year: 2027,
  github_username: "alice",
  twitter_handle: "@alice",
  source_urls: [
    sourceUrl({
      source: "arxiv",
      description: "Built with Cursor for reproducible ML benchmarks",
      observed_at: "2026-02-01T00:00:00.000Z",
    }),
    sourceUrl({
      source: "devpost",
      description: "HackMIT 2026 finalist submission",
      observed_at: "2026-03-01T00:00:00.000Z",
    }),
    sourceUrl({
      source: "github",
      description: "Significant OSS contribution log",
      observed_at: "2026-03-15T00:00:00.000Z",
    }),
  ],
};

describe("computeDhvcScoreFromCandidate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("scores all five dimensions between 0 and 100", () => {
    const s = computeDhvcScoreFromCandidate(baseCandidate);
    expect(s.technical_output).toBeGreaterThanOrEqual(0);
    expect(s.technical_output).toBeLessThanOrEqual(100);
    expect(s.public_reach).toBeGreaterThanOrEqual(0);
    expect(s.public_reach).toBeLessThanOrEqual(100);
    expect(s.school_fit).toBeGreaterThanOrEqual(0);
    expect(s.school_fit).toBeLessThanOrEqual(100);
    expect(s.cursor_signal).toBeGreaterThanOrEqual(0);
    expect(s.cursor_signal).toBeLessThanOrEqual(100);
    expect(s.total).toBeGreaterThanOrEqual(0);
    expect(s.total).toBeLessThanOrEqual(100);
  });

  it("uses empty-source defaults: technical floor and zero cursor signal", () => {
    const s = computeDhvcScoreFromCandidate({
      institution_id: "some_school",
      graduation_year: undefined,
      github_username: undefined,
      twitter_handle: undefined,
      source_urls: [],
    });
    expect(s.technical_output).toBe(10);
    expect(s.cursor_signal).toBe(0);
    expect(s.public_reach).toBeLessThanOrEqual(40);
  });

  it("school tier separates tier-1, tier-2, and other baseline", () => {
    const urls = [
      sourceUrl({
        source: "devpost",
        description: "Contest",
      }),
    ];
    const t1 = computeDhvcScoreFromCandidate({
      ...baseCandidate,
      institution_id: "mit",
      source_urls: urls,
      github_username: undefined,
      twitter_handle: undefined,
    });
    const t2 = computeDhvcScoreFromCandidate({
      ...baseCandidate,
      institution_id: "harvard",
      source_urls: urls,
      github_username: undefined,
      twitter_handle: undefined,
    });
    const t3 = computeDhvcScoreFromCandidate({
      ...baseCandidate,
      institution_id: "regional_state",
      source_urls: urls,
      github_username: undefined,
      twitter_handle: undefined,
    });

    expect(t1.school_fit).toBeGreaterThan(t2.school_fit);
    expect(t2.school_fit).toBeGreaterThan(t3.school_fit);
    expect(t1.total).toBeGreaterThan(t3.total);
  });

  it("maps graduation year buckets at tier-1 institution (fixed clock)", () => {
    const base = {
      institution_id: "stanford",
      source_urls: [
        sourceUrl({ source: "github", description: "Contributions" }),
      ],
      github_username: undefined,
      twitter_handle: undefined,
    };

    const senior2027 = computeDhvcScoreFromCandidate({
      ...base,
      graduation_year: 2027,
    });
    const junior2028 = computeDhvcScoreFromCandidate({
      ...base,
      graduation_year: 2028,
    });
    const grad2031 = computeDhvcScoreFromCandidate({
      ...base,
      graduation_year: 2031,
    });
    const already2026 = computeDhvcScoreFromCandidate({
      ...base,
      graduation_year: 2026,
    });

    expect(senior2027.school_fit).toBeGreaterThan(junior2028.school_fit);
    expect(junior2028.school_fit).toBeGreaterThan(already2026.school_fit);
    expect(already2026.school_fit).toBeGreaterThan(grad2031.school_fit);
  });

  it("all three URL sources outperform a single-source profile on reach and technical", () => {
    const common = {
      institution_id: "cmu",
      graduation_year: 2027 as number | undefined,
      github_username: "dev",
      twitter_handle: undefined as string | undefined,
    };

    const single = computeDhvcScoreFromCandidate({
      ...common,
      source_urls: [
        sourceUrl({
          source: "devpost",
          description: "Solo finalist",
        }),
      ],
    });

    const allSources = computeDhvcScoreFromCandidate({
      ...common,
      source_urls: [
        sourceUrl({ source: "devpost", description: "Hack" }),
        sourceUrl({ source: "github", description: "Repo" }),
        sourceUrl({
          source: "arxiv",
          description: "Paper",
          url: "https://arxiv.org/abs/2301",
        }),
      ],
    });

    expect(allSources.technical_output).toBeGreaterThanOrEqual(
      single.technical_output
    );
    expect(allSources.public_reach).toBeGreaterThan(single.public_reach);
    expect(allSources.total).toBeGreaterThan(single.total);
  });

  it("single-source presence still yields a bounded technical score with recency", () => {
    const s = computeDhvcScoreFromCandidate({
      institution_id: "berkeley",
      graduation_year: 2028,
      github_username: undefined,
      twitter_handle: undefined,
      source_urls: [
        sourceUrl({
          source: "github",
          description: "OSS contribution graph only",
          observed_at: "2026-04-20T00:00:00.000Z",
        }),
      ],
    });
    expect(s.technical_output).toBeGreaterThan(10);
    expect(s.technical_output).toBeLessThanOrEqual(100);
    expect(s.cursor_signal).toBe(15);
  });

  it("stale observed_at drops the recency bump vs recent signals", () => {
    const stale = computeDhvcScoreFromCandidate({
      institution_id: "mit",
      graduation_year: 2027,
      github_username: undefined,
      twitter_handle: undefined,
      source_urls: [
        sourceUrl({
          source: "devpost",
          description: "Old hackathon",
          observed_at: "2023-01-01T00:00:00.000Z",
        }),
      ],
    });
    const recent = computeDhvcScoreFromCandidate({
      institution_id: "mit",
      graduation_year: 2027,
      github_username: undefined,
      twitter_handle: undefined,
      source_urls: [
        sourceUrl({
          source: "devpost",
          description: "Recent hackathon",
          observed_at: "2026-04-20T00:00:00.000Z",
        }),
      ],
    });

    expect(recent.technical_output).toBeGreaterThan(stale.technical_output);
  });

  it("weights dimensions into total (sanity check)", () => {
    const s = computeDhvcScoreFromCandidate({
      institution_id: "mit",
      graduation_year: 2027,
      github_username: "gh",
      twitter_handle: "@tw",
      source_urls: [
        sourceUrl({ source: "arxiv", description: "cursor paper" }),
      ],
    });
    const manual =
      0.3 * s.technical_output +
      0.2 * s.public_reach +
      0.25 * s.school_fit +
      0.25 * s.cursor_signal;
    expect(s.total).toBe(Math.round(manual));
  });

  it("produces lower totals for sparse profiles than rich ones", () => {
    const weak = computeDhvcScoreFromCandidate({
      institution_id: "regional_state",
      graduation_year: undefined,
      github_username: undefined,
      twitter_handle: undefined,
      source_urls: [],
    });
    const strong = computeDhvcScoreFromCandidate(baseCandidate);
    expect(strong.total).toBeGreaterThan(weak.total);
  });
});

describe("scoreDhvcCandidate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T12:00:00.000Z"));
    vi.mocked(logObservation).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("logs dhvc_candidate_scored with score and weights", async () => {
    const candidate: DhvcCandidate = {
      id: "cand-123",
      institution_id: "mit",
      name: "Test",
      primary_source: "manual",
      source_urls: [],
      review_stage: "pending_review",
      discovered_at: "2026-05-01T00:00:00.000Z",
    };

    const score = await scoreDhvcCandidate(candidate);

    expect(score).toEqual(computeDhvcScoreFromCandidate(candidate));
    expect(logObservation).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logObservation).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        entity_type: "dhvc_candidate",
        entity_id: "cand-123",
        observation_type: "dhvc_candidate_scored",
        source: "manual",
        confidence: 0.7,
        payload: expect.objectContaining({
          score,
          weights: {
            technical_output: 0.3,
            public_reach: 0.2,
            school_fit: 0.25,
            cursor_signal: 0.25,
          },
        }),
      })
    );
  });
});
