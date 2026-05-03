import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.hoisted(() => vi.fn());

vi.mock("node-fetch", () => ({
  default: mockFetch,
}));

import type { DhvcCandidateDraft } from "@/lib/types";
import {
  dedupeDevpostDrafts,
  DEVPOST_MIN_INTERVAL_MS,
  discoverFromDevpost,
  HACKATHON_URLS,
  resolveDevpostInstitutionId,
  scrapeHackathonFinalists,
} from "@/lib/sources/devpost";

function htmlResponse(status: number, body: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  };
}

const GALLERY_URL = "https://hackmit-2024.devpost.com/project-gallery";

function galleryHtml(): string {
  return `
    <div class="gallery-item">
      <a href="/submissions/123-demo">Demo</a>
      <span>Finalist</span>
    </div>`;
}

function submissionHtml(): string {
  return `
    <main>
      <h1>Neat Project</h1>
      <div id="software-team">
        <a href="https://devpost.com/alice_dev">Alice</a>
        <a href="https://devpost.com/bob_dev">Bob</a>
      </div>
    </main>`;
}

function profileAlice(): string {
  return `
    <body>
      <h1>Alice Ng</h1>
      <p data-school="MIT"></p>
      <a href="https://github.com/alicegh">GitHub</a>
    </body>`;
}

function profileBob(): string {
  return `
    <body>
      <h1>Bob Lee</h1>
      <p>Student at Stanford University.</p>
      <a href="https://twitter.com/bobtw">Twitter</a>
    </body>`;
}

describe("devpost scraper", () => {
  beforeEach(() => {
    vi.useRealTimers();
    process.env.BEACON_DEVPOST_THROTTLE_MS = "0";
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.BEACON_DEVPOST_THROTTLE_MS;
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("lists fifteen hardcoded hackathon gallery URLs", () => {
    expect(HACKATHON_URLS).toHaveLength(15);
  });

  it("resolves top-tier school strings to institution ids", () => {
    expect(resolveDevpostInstitutionId("MIT")).toBe("mit");
    expect(resolveDevpostInstitutionId("Student at UC Berkeley")).toBe(
      "berkeley"
    );
    expect(resolveDevpostInstitutionId("Random Online")).toBeNull();
  });

  it("dedupes drafts by normalized name and institution", () => {
    const a: DhvcCandidateDraft = {
      institution_id: "mit",
      name: "Alice  Ng",
      github_username: "alicegh",
      primary_source: "devpost",
      source_urls: [
        {
          url: "https://x.devpost.com/submissions/a",
          source: "devpost",
          observed_at: "2026-01-01T00:00:00.000Z",
          description: "Ev1",
        },
      ],
    };
    const b: DhvcCandidateDraft = {
      institution_id: "mit",
      name: "alice ng",
      github_username: "alicegh",
      primary_source: "devpost",
      source_urls: [
        {
          url: "https://x.devpost.com/submissions/b",
          source: "devpost",
          observed_at: "2026-01-02T00:00:00.000Z",
          description: "Ev2",
        },
      ],
    };
    const out = dedupeDevpostDrafts([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].source_urls.map((u) => u.url)).toEqual([
      "https://x.devpost.com/submissions/a",
      "https://x.devpost.com/submissions/b",
    ]);
  });

  it("scrapes finalist submissions and participant profiles via mocked fetch", async () => {
    const subUrl = "https://hackmit-2024.devpost.com/submissions/123-demo";
    mockFetch
      .mockResolvedValueOnce(htmlResponse(200, galleryHtml()))
      .mockResolvedValueOnce(htmlResponse(200, submissionHtml()))
      .mockResolvedValueOnce(htmlResponse(200, profileAlice()))
      .mockResolvedValueOnce(htmlResponse(200, profileBob()));

    const drafts = await scrapeHackathonFinalists(GALLERY_URL);

    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(drafts).toHaveLength(2);
    const byName = Object.fromEntries(drafts.map((d) => [d.name, d]));
    expect(byName["Alice Ng"]?.institution_id).toBe("mit");
    expect(byName["Alice Ng"]?.github_username).toBe("alicegh");
    expect(byName["Bob Lee"]?.institution_id).toBe("stanford");
    expect(byName["Bob Lee"]?.twitter_handle).toBe("bobtw");
    expect(byName["Alice Ng"]?.source_urls[0]?.url).toBe(subUrl);
  });

  // Ordered before the 429 test: fake timers can leave stalled macrotasks that
  // time out the next test when it awaits real `setTimeout` throttling.
  it("discoverFromDevpost aggregates all hackathons with mocked responses", async () => {
    const emptyGallery = "<html><body><p>No submissions</p></body></html>";
    mockFetch.mockResolvedValue(htmlResponse(200, emptyGallery));

    const drafts = await discoverFromDevpost();
    expect(drafts).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(HACKATHON_URLS.length);
  });

  it("retries 429 with 30s backoff before succeeding (no real Devpost)", async () => {
    vi.useFakeTimers();

    mockFetch
      .mockResolvedValueOnce(htmlResponse(429, ""))
      .mockResolvedValueOnce(htmlResponse(200, galleryHtml()))
      .mockResolvedValueOnce(htmlResponse(200, submissionHtml()))
      .mockResolvedValueOnce(htmlResponse(200, profileAlice()))
      .mockResolvedValueOnce(htmlResponse(200, profileBob()));

    const p = scrapeHackathonFinalists(GALLERY_URL);

    await vi.advanceTimersByTimeAsync(30_000);

    const drafts = await p;
    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(5);
    expect(drafts.some((d) => d.name === "Alice Ng")).toBe(true);
  });
});

describe("DEVPOST_MIN_INTERVAL_MS", () => {
  it("matches spec default (500ms)", () => {
    expect(DEVPOST_MIN_INTERVAL_MS).toBe(500);
  });
});
