import { logObservation } from "@/lib/observations";
import type { AmbassadorApplicationData, AmbassadorScore } from "@/lib/types";

const W_RESEARCH = 0.3;
const W_STUDENT_REACH = 0.25;
const W_ADOPTION = 0.25;
const W_NETWORK = 0.2;

const RESEARCH_KEYWORDS =
  /\b(cursor|llm|language model|research|paper|arxiv|ai coding|code generation|machine learning|nlp|software engineering|productivity)\b/gi;

const ADOPTION_KEYWORDS =
  /\b(workshop|hackathon|event|meetup|talk|demo|session|series|bootcamp|cafe)\b/gi;

const NETWORK_KEYWORDS =
  /\b(lead|organiz|president|chair|volunteer|chapter|community|mentor|founder|team)\b/gi;

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreByLength(text: string, minGood = 80, maxGood = 400): number {
  const t = text.trim();
  if (t.length === 0) return 15;
  if (t.length < 40) return clamp100(20 + t.length * 0.5);
  if (t.length < minGood) return clamp100(35 + (t.length / minGood) * 35);
  if (t.length <= maxGood) return clamp100(70 + (t.length / maxGood) * 25);
  return 95;
}

function scoreResearchAlignment(why_cursor: string): number {
  const base = scoreByLength(why_cursor, 100, 500);
  const matches = why_cursor.match(RESEARCH_KEYWORDS);
  const bonus = Math.min(25, (matches?.length ?? 0) * 5);
  return clamp100(base * 0.65 + bonus);
}

/** Parse a rough numeric reach from free text (e.g. "500+", "~200 students") */
function parseReachNumber(text: string): number | null {
  const m = text.match(/[\d,]+/);
  if (!m) return null;
  const n = Number.parseInt(m[0].replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function scoreStudentReach(expected_reach: string): number {
  const t = expected_reach.trim();
  if (!t) return 10;
  const n = parseReachNumber(t);
  if (n !== null) {
    if (n >= 500) return 95;
    if (n >= 200) return 80;
    if (n >= 80) return 65;
    if (n >= 30) return 50;
    return clamp100(25 + n * 0.5);
  }
  return scoreByLength(t, 40, 200) * 0.85;
}

function scoreAdoptionSignal(proposed_events: string): number {
  const base = scoreByLength(proposed_events, 60, 350);
  const matches = proposed_events.match(ADOPTION_KEYWORDS);
  const bonus = Math.min(30, (matches?.length ?? 0) * 8);
  return clamp100(base * 0.6 + bonus);
}

function scoreNetworkInfluence(past_community_work: string): number {
  const base = scoreByLength(past_community_work, 80, 400);
  const matches = past_community_work.match(NETWORK_KEYWORDS);
  const bonus = Math.min(25, (matches?.length ?? 0) * 6);
  return clamp100(base * 0.65 + bonus);
}

/**
 * Pure scoring for tests and reuse (no I/O).
 */
export function computeAmbassadorScoreFromApplicationData(
  data: AmbassadorApplicationData
): AmbassadorScore {
  const research_alignment = scoreResearchAlignment(data.why_cursor);
  const student_reach = scoreStudentReach(data.expected_reach);
  const adoption_signal = scoreAdoptionSignal(data.proposed_events);
  const network_influence = scoreNetworkInfluence(data.past_community_work);

  const total = clamp100(
    W_RESEARCH * research_alignment +
      W_STUDENT_REACH * student_reach +
      W_ADOPTION * adoption_signal +
      W_NETWORK * network_influence
  );

  return {
    research_alignment,
    student_reach,
    adoption_signal,
    network_influence,
    total,
  };
}

const SCORING_CONFIDENCE = 0.7;

/**
 * Computes score and appends `ambassador_scored` observation.
 */
export async function scoreAmbassador(
  application_data: AmbassadorApplicationData,
  ambassadorId: string
): Promise<AmbassadorScore> {
  const score = computeAmbassadorScoreFromApplicationData(application_data);

  await logObservation({
    entity_type: "ambassador",
    entity_id: ambassadorId,
    observation_type: "ambassador_scored",
    payload: {
      research_alignment: score.research_alignment,
      student_reach: score.student_reach,
      adoption_signal: score.adoption_signal,
      network_influence: score.network_influence,
      total: score.total,
    },
    source: "manual",
    confidence: SCORING_CONFIDENCE,
  });

  return score;
}
