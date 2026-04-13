/**
 * Exact keyword relevance for papers (title + abstract), case-insensitive.
 * Rules: .cursor/rules/data-contracts.md — no semantic classification.
 */

export interface PaperKeywordMatch {
  matches: boolean;
  /** Human-readable labels for matched rules (for observation payloads). */
  matchedPhrases: string[];
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function includesPhrase(haystackNorm: string, phrase: string): boolean {
  return haystackNorm.includes(normalize(phrase));
}

function hasWord(haystack: string, pattern: string): boolean {
  return new RegExp(pattern, "i").test(haystack);
}

/**
 * Combined title + abstract (both optional) as one searchable corpus.
 */
export function paperText(title: string, abstract?: string | null): string {
  const t = title ?? "";
  const a = abstract ?? "";
  return `${t}\n${a}`;
}

/**
 * Returns whether any Beacon keyword rule matches and which rules fired.
 */
export function matchPaperKeywords(
  title: string,
  abstract?: string | null
): PaperKeywordMatch {
  const raw = paperText(title, abstract);
  const haystack = raw;
  const haystackNorm = normalize(raw);
  const matchedPhrases: string[] = [];

  const add = (label: string) => {
    if (!matchedPhrases.includes(label)) matchedPhrases.push(label);
  };

  if (haystackNorm.length === 0) {
    return { matches: false, matchedPhrases: [] };
  }

  if (includesPhrase(haystackNorm, "large language model")) {
    add("large language model");
  }
  if (hasWord(haystack, String.raw`\bllm\b`)) {
    add("LLM");
  }
  if (includesPhrase(haystackNorm, "language model")) {
    add("language model");
  }
  if (includesPhrase(haystackNorm, "code generation")) {
    add("code generation");
  }
  if (includesPhrase(haystackNorm, "code completion")) {
    add("code completion");
  }
  if (includesPhrase(haystackNorm, "ai-assisted programming")) {
    add("AI-assisted programming");
  }
  if (includesPhrase(haystackNorm, "ai coding")) {
    add("AI coding");
  }
  if (includesPhrase(haystackNorm, "developer productivity")) {
    add("developer productivity");
  }
  if (hasWord(haystack, String.raw`\bcopilot\b`)) {
    add("Copilot");
  }
  if (hasWord(haystack, String.raw`\bcursor\b`)) {
    add("Cursor");
  }
  if (
    includesPhrase(haystackNorm, "software engineering") &&
    (hasWord(haystack, String.raw`\bai\b`) || hasWord(haystack, String.raw`\bml\b`))
  ) {
    add('software engineering + ("AI" or "ML")');
  }
  if (includesPhrase(haystackNorm, "program synthesis")) {
    add("program synthesis");
  }
  if (
    includesPhrase(haystackNorm, "repository-level") &&
    includesPhrase(haystackNorm, "model")
  ) {
    add('"repository-level" + "model"');
  }
  if (
    includesPhrase(haystackNorm, "chain of thought") &&
    includesPhrase(haystackNorm, "code")
  ) {
    add('"chain of thought" + "code"');
  }

  return {
    matches: matchedPhrases.length > 0,
    matchedPhrases,
  };
}
