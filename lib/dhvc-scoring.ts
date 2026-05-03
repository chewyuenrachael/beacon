// @ownership dhvc-module

import { logObservation } from "@/lib/observations";
import type { DhvcCandidate, DhvcScore, DhvcSourceUrl } from "@/lib/types";

const W_TECHNICAL = 0.3;
const W_REACH = 0.2;
const W_FIT = 0.25;
const W_CURSOR = 0.25;

const SCORING_CONFIDENCE = 0.7;

// School tier ranking — top 5 vs top 10 vs top 20 vs other
const TIER_1 = new Set([
  "mit",
  "stanford",
  "cmu",
  "berkeley",
  "columbia",
]);
const TIER_2 = new Set([
  "cornell",
  "princeton",
  "caltech",
  "gatech",
  "uiuc",
  "umich",
  "uwash",
  "ucla",
  "uchicago",
  "harvard",
]);
const TIER_3_BASELINE_SCORE = 50;

// Year multipliers — rising senior > sophomore > grad student for calcification thesis
const YEAR_MULTIPLIERS: Record<string, number> = {
  rising_senior: 1.0,
  rising_junior: 0.95,
  rising_sophomore: 0.85,
  rising_freshman: 0.6,
  grad_student: 0.7,
  unknown: 0.75,
};

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function inferYearLabel(graduationYear: number | undefined): string {
  if (!graduationYear) return "unknown";
  const currentYear = new Date().getFullYear();
  const yearsToGrad = graduationYear - currentYear;
  if (yearsToGrad <= 0) return "unknown";
  if (yearsToGrad === 1) return "rising_senior";
  if (yearsToGrad === 2) return "rising_junior";
  if (yearsToGrad === 3) return "rising_sophomore";
  if (yearsToGrad === 4) return "rising_freshman";
  return "grad_student";
}

/**
 * Technical output: number, recency, and depth of public artifacts.
 * Inputs: count of source URLs by type, recency of those URLs.
 */
function scoreTechnicalOutput(sourceUrls: DhvcSourceUrl[]): number {
  if (sourceUrls.length === 0) return 10;

  const devpostCount = sourceUrls.filter((s) => s.source === "devpost").length;
  const githubCount = sourceUrls.filter((s) => s.source === "github").length;
  const arxivCount = sourceUrls.filter((s) => s.source === "arxiv").length;

  // arXiv first-author paper as undergrad is the strongest signal
  let base = 25;
  base += Math.min(35, arxivCount * 25); // each undergrad paper = strong
  base += Math.min(30, devpostCount * 12); // each finalist appearance
  base += Math.min(20, githubCount * 4); // each significant contribution

  // Recency: at least one signal within 12 months
  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const hasRecentSignal = sourceUrls.some(
    (s) => new Date(s.observed_at).getTime() > oneYearAgo
  );
  if (hasRecentSignal) base += 10;

  return clamp100(base);
}

/**
 * Public reach: presence and visibility on public channels.
 * Inputs: github_username present, twitter_handle present, count of public URLs.
 */
function scorePublicReach(
  candidate: Pick<
    DhvcCandidate,
    "github_username" | "twitter_handle" | "source_urls"
  >
): number {
  let base = 30;
  if (candidate.github_username) base += 15;
  if (candidate.twitter_handle) base += 25; // Twitter handle is the strongest reach signal
  base += Math.min(30, candidate.source_urls.length * 4);

  // Bonus for cross-platform presence
  const sources = new Set(candidate.source_urls.map((s) => s.source));
  if (sources.size >= 2) base += 10;
  if (sources.size >= 3) base += 5;

  return clamp100(base);
}

/**
 * School fit: institution tier × year multiplier.
 * Inputs: institution_id, graduation_year.
 */
function scoreSchoolFit(
  institutionId: string,
  graduationYear?: number
): number {
  let baseTierScore: number;
  if (TIER_1.has(institutionId)) baseTierScore = 95;
  else if (TIER_2.has(institutionId)) baseTierScore = 80;
  else baseTierScore = TIER_3_BASELINE_SCORE;

  const yearLabel = inferYearLabel(graduationYear);
  const multiplier = YEAR_MULTIPLIERS[yearLabel] ?? 0.75;

  return clamp100(baseTierScore * multiplier);
}

/**
 * Cursor signal: have they shown public Cursor affinity?
 * Inputs: source_urls with description matching Cursor mentions.
 * NOTE: Day 1 is heuristic on description text. Day 30+ enrichment will scan
 * GitHub repos for Cursor commit trailers and Twitter mentions.
 */
function scoreCursorSignal(sourceUrls: DhvcSourceUrl[]): number {
  if (sourceUrls.length === 0) return 0;

  const cursorMentions = sourceUrls.filter(
    (s) =>
      /\bcursor\b/i.test(s.description) ||
      /\bbuilt with cursor\b/i.test(s.description)
  ).length;

  if (cursorMentions === 0) return 15; // baseline: no signal yet, but they're DHVC-worthy on other axes
  if (cursorMentions === 1) return 50;
  if (cursorMentions === 2) return 75;
  return 95;
}

/**
 * Pure scoring for tests and reuse (no I/O).
 */
export function computeDhvcScoreFromCandidate(
  candidate: Pick<
    DhvcCandidate,
    | "institution_id"
    | "graduation_year"
    | "github_username"
    | "twitter_handle"
    | "source_urls"
  >
): DhvcScore {
  const technical_output = scoreTechnicalOutput(candidate.source_urls);
  const public_reach = scorePublicReach(candidate);
  const school_fit = scoreSchoolFit(
    candidate.institution_id,
    candidate.graduation_year
  );
  const cursor_signal = scoreCursorSignal(candidate.source_urls);

  const total = clamp100(
    W_TECHNICAL * technical_output +
      W_REACH * public_reach +
      W_FIT * school_fit +
      W_CURSOR * cursor_signal
  );

  return { technical_output, public_reach, school_fit, cursor_signal, total };
}

/**
 * Score a candidate and persist the score + observation.
 */
export async function scoreDhvcCandidate(
  candidate: DhvcCandidate
): Promise<DhvcScore> {
  const score = computeDhvcScoreFromCandidate(candidate);

  await logObservation({
    entity_type: "dhvc_candidate",
    entity_id: candidate.id,
    observation_type: "dhvc_candidate_scored",
    payload: {
      score,
      weights: {
        technical_output: W_TECHNICAL,
        public_reach: W_REACH,
        school_fit: W_FIT,
        cursor_signal: W_CURSOR,
      },
    },
    source: "manual",
    confidence: SCORING_CONFIDENCE,
  });

  return score;
}
