import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildProfessorArxivFactsBundle,
  buildReferencedFactsFromProfessorContext,
  generateOutreachDraft,
  isLegalOutreachTransition,
} from "@/lib/outreach-generator";
import type { Professor } from "@/lib/types";
import type { PaperMatchFactLine } from "@/lib/types/outreach";

describe("isLegalOutreachTransition", () => {
  it("allows same stage", () => {
    expect(isLegalOutreachTransition("cold", "cold")).toBe(true);
  });

  it("allows single forward step", () => {
    expect(isLegalOutreachTransition("cold", "contacted")).toBe(true);
    expect(isLegalOutreachTransition("contacted", "meeting_booked")).toBe(
      true
    );
  });

  it("disallows skipping stages", () => {
    expect(isLegalOutreachTransition("cold", "meeting_booked")).toBe(false);
  });

  it("allows dead from any non-dead stage", () => {
    expect(isLegalOutreachTransition("cold", "dead")).toBe(true);
    expect(isLegalOutreachTransition("partnership_active", "dead")).toBe(
      true
    );
  });

  it("disallows leaving dead", () => {
    expect(isLegalOutreachTransition("dead", "cold")).toBe(false);
    expect(isLegalOutreachTransition("dead", "contacted")).toBe(false);
  });
});

describe("buildProfessorArxivFactsBundle", () => {
  it("includes literal instruction and verbatim paper titles", () => {
    const professor = {
      id: "p1",
      institution_id: "mit",
      name: "Prof",
      public_statements: [],
      recent_relevant_papers_count: 0,
    } as Professor;

    const paperLines: PaperMatchFactLine[] = [
      {
        title: "Exact Paper Title From Observation",
        abstract_snippet: "First sentence of abstract verbatim.",
        observed_at: "2026-01-01T00:00:00Z",
      },
    ];

    const bundle = buildProfessorArxivFactsBundle({
      paperLines,
      professor,
      syllabusLines: [],
    });

    expect(bundle).toContain(
      "Reference only the following facts from this professor's arxiv pipeline:"
    );
    expect(bundle).toContain("Exact Paper Title From Observation");
    expect(bundle).toContain("Abstract snippet: First sentence of abstract verbatim.");
    expect(bundle).toContain("Do not paraphrase paper titles.");
  });
});

describe("buildReferencedFactsFromProfessorContext", () => {
  it("grounds paper_match facts in observation-shaped lines", () => {
    const professor = {
      id: "p1",
      institution_id: "mit",
      name: "Prof",
      public_statements: [],
      recent_relevant_papers_count: 0,
    } as Professor;

    const facts = buildReferencedFactsFromProfessorContext({
      paperLines: [
        {
          title: "T",
          abstract_snippet: "A",
          observed_at: "2026-01-01",
        },
      ],
      professor,
      syllabusLines: [],
    });

    expect(facts[0]?.kind).toBe("paper_match");
    expect(facts[0]?.text).toContain("T");
    expect(facts[0]?.text).toContain("Abstract snippet: A");
  });
});

describe("generateOutreachDraft", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function mockClientForProfessor(): SupabaseClient {
    let obsQueryCount = 0;
    const profRow = {
      id: "sasha-rush",
      institution_id: "cornell",
      name: "Alexander Rush",
      title: "Professor",
      public_statements: [],
      recent_relevant_papers_count: 1,
      ai_stance_quote: "AI tools can help students learn faster.",
      ai_stance_source_url: "https://example.com/stance",
    };

    const paperObs = [
      {
        payload: {
          title: "Paper From Observation Payload",
          abstract: "Abstract body text for snippet.",
        },
        observed_at: "2026-02-01T12:00:00Z",
        source_url: "https://arxiv.org/abs/1234.5678",
      },
    ];

    return {
      from(table: string) {
        if (table === "professors") {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            maybeSingle: async () => ({ data: profRow, error: null }),
          };
        }
        if (table === "institutions") {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            maybeSingle: async () => ({
              data: { name: "Cornell University" },
              error: null,
            }),
          };
        }
        if (table === "observations") {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            order() {
              return this;
            },
            limit() {
              obsQueryCount += 1;
              if (obsQueryCount === 1) {
                return Promise.resolve({ data: paperObs, error: null });
              }
              return Promise.resolve({ data: [], error: null });
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as unknown as SupabaseClient;
  }

  it("uses template when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const draft = await generateOutreachDraft(
      "professor",
      "sasha-rush",
      { supabase: mockClientForProfessor() }
    );

    expect(draft.subject_line.length).toBeGreaterThan(0);
    expect(draft.body).toContain("Alexander Rush");
    expect(draft.referenced_facts.some((f) => f.kind === "paper_match")).toBe(
      true
    );
    expect(draft.referenced_facts.some((f) => f.text.includes("Paper From Observation Payload"))).toBe(
      true
    );
  });

  it("uses Claude JSON when ANTHROPIC_API_KEY is set and fetch succeeds", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({
          content: [
            {
              text: `"subject_line": "Hello",
"body": "Body text here.",
"tone": "warm"}`,
            },
          ],
        }),
      }))
    );

    const draft = await generateOutreachDraft(
      "professor",
      "sasha-rush",
      { supabase: mockClientForProfessor() }
    );

    expect(draft.subject_line).toBe("Hello");
    expect(draft.body).toBe("Body text here.");
    expect(draft.tone).toBe("warm");
    expect(draft.referenced_facts.length).toBeGreaterThan(0);
    expect(
      draft.referenced_facts.some((f) =>
        f.text.includes("Paper From Observation Payload")
      )
    ).toBe(true);
  });
});
