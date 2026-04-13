import { differenceInCalendarDays } from "date-fns";
import { logObservation } from "@/lib/observations";
import { supabaseAdmin } from "@/lib/supabase";
import { mapAmbassadorRow } from "@/lib/ambassador-pipeline";

export interface AmbassadorHealthSignals {
  /** Count of observations for this ambassador in the last 90 days */
  observationsLast90Days: number;
  /** Completed (or scheduled) events linked to ambassador in last 90 days, if `events` table exists */
  eventsLast90Days: number;
  /** Calendar days since `last_active_at`; null if never set */
  daysSinceLastActive: number | null;
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Pure health computation for unit tests (no DB).
 */
export function computeHealthScoreFromSignals(
  s: AmbassadorHealthSignals
): number {
  let score = 42;

  score += Math.min(28, s.observationsLast90Days * 3);
  score += Math.min(18, s.eventsLast90Days * 6);

  if (s.daysSinceLastActive === null) {
    score -= 8;
  } else if (s.daysSinceLastActive > 90) {
    score -= 38;
  } else if (s.daysSinceLastActive > 45) {
    score -= 22;
  } else if (s.daysSinceLastActive > 14) {
    score -= Math.min(18, (s.daysSinceLastActive - 14) * 0.7);
  } else if (s.daysSinceLastActive <= 3) {
    score += 12;
  }

  return clamp100(score);
}

async function countEventsLast90Days(ambassadorId: string): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const sinceIso = since.toISOString();

  try {
    const { count, error } = await supabaseAdmin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("ambassador_id", ambassadorId)
      .gte("scheduled_at", sinceIso);

    if (error) {
      if (
        error.message?.includes("relation") &&
        error.message?.includes("does not exist")
      ) {
        return 0;
      }
      if (error.code === "42P01") return 0;
      return 0;
    }
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function countObservationsLast90Days(
  ambassadorId: string
): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const sinceIso = since.toISOString();

  const { count, error } = await supabaseAdmin
    .from("observations")
    .select("id", { count: "exact", head: true })
    .eq("entity_type", "ambassador")
    .eq("entity_id", ambassadorId)
    .gte("observed_at", sinceIso);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Recomputes health from recent activity signals, logs `ambassador_health_computed`, updates projection.
 */
export async function computeHealthScore(
  ambassadorId: string
): Promise<number> {
  const { data: row, error: loadErr } = await supabaseAdmin
    .from("ambassadors")
    .select("*")
    .eq("id", ambassadorId)
    .maybeSingle();

  if (loadErr) throw loadErr;
  if (!row) {
    throw new Error("Ambassador not found");
  }

  const ambassador = mapAmbassadorRow(row as Record<string, unknown>);

  let daysSinceLastActive: number | null = null;
  if (ambassador.last_active_at) {
    const last = new Date(ambassador.last_active_at);
    if (!Number.isNaN(last.getTime())) {
      daysSinceLastActive = differenceInCalendarDays(new Date(), last);
    }
  }

  const [observationsLast90Days, eventsLast90Days] = await Promise.all([
    countObservationsLast90Days(ambassadorId),
    countEventsLast90Days(ambassadorId),
  ]);

  const signals: AmbassadorHealthSignals = {
    observationsLast90Days,
    eventsLast90Days,
    daysSinceLastActive,
  };

  const health = computeHealthScoreFromSignals(signals);

  await logObservation({
    entity_type: "ambassador",
    entity_id: ambassadorId,
    observation_type: "ambassador_health_computed",
    payload: {
      health_score: health,
      observations_last_90d: observationsLast90Days,
      events_last_90d: eventsLast90Days,
      days_since_last_active: daysSinceLastActive,
    },
    source: "manual",
    confidence: 0.7,
  });

  const { error: updErr } = await supabaseAdmin
    .from("ambassadors")
    .update({ health_score: health })
    .eq("id", ambassadorId);

  if (updErr) throw updErr;

  return health;
}
