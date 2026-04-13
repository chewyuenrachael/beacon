import { describe, expect, it } from "vitest";
import { matchPaperKeywords, paperText } from "@/lib/keyword-paper-match";

describe("matchPaperKeywords", () => {
  it("matches a single keyword phrase (large language model)", () => {
    const r = matchPaperKeywords("Scaling large language models", "");
    expect(r.matches).toBe(true);
    expect(r.matchedPhrases).toContain("large language model");
  });

  it("matches multiple distinct rules in one paper", () => {
    const r = matchPaperKeywords(
      "Large language models for code generation",
      "We study program synthesis."
    );
    expect(r.matches).toBe(true);
    expect(r.matchedPhrases).toContain("large language model");
    expect(r.matchedPhrases).toContain("code generation");
    expect(r.matchedPhrases).toContain("program synthesis");
  });

  it("is case-insensitive for phrases and word rules", () => {
    const r = matchPaperKeywords("CODE GENERATION with an LLM", "");
    expect(r.matches).toBe(true);
    expect(r.matchedPhrases).toContain("code generation");
    expect(r.matchedPhrases).toContain("LLM");
  });

  it('requires "software engineering" and AI/ML word boundaries together', () => {
    expect(
      matchPaperKeywords(
        "software engineering for systems",
        "nothing to report without those terms."
      ).matches
    ).toBe(false);
    const r = matchPaperKeywords(
      "Empirical software engineering",
      "We apply ML to the workflow."
    );
    expect(r.matches).toBe(true);
    expect(r.matchedPhrases.some((p) => p.includes("software engineering"))).toBe(
      true
    );
  });

  it("returns no match for empty title and empty or missing abstract", () => {
    expect(matchPaperKeywords("", "").matches).toBe(false);
    expect(matchPaperKeywords("", null).matches).toBe(false);
    expect(matchPaperKeywords("   ", undefined).matches).toBe(false);
    expect(paperText("", null)).toBe("\n");
  });

  it("does not treat substring Allm as LLM; does match standalone LLM", () => {
    expect(matchPaperKeywords("Allm", "nothing").matches).toBe(false);
    const r = matchPaperKeywords("Survey", "We compare this LLM to baselines.");
    expect(r.matches).toBe(true);
    expect(r.matchedPhrases).toContain("LLM");
  });
});
