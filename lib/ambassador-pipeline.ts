import type { SupabaseClient } from "@supabase/supabase-js";
import { logObservation } from "@/lib/observations";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type {
  Ambassador,
  AmbassadorStage,
  Observation,
  ObservationType,
} from "@/lib/types";
import { AMBASSADOR_STAGES } from "@/lib/types";

const STAGE_SET = new Set<string>(AMBASSADOR_STAGES);

/** Legal directed transitions (from -> allowed to[]) */
const LEGAL_TRANSITIONS: Record<AmbassadorStage, readonly AmbassadorStage[]> = {
  applied: ["under_review", "rejected"],
  under_review: ["accepted", "rejected"],
  accepted: ["onboarding"],
  onboarding: ["active"],
  active: ["slowing", "inactive"],
  slowing: ["active", "inactive"],
  rejected: [],
  inactive: [],
};

export function isAmbassadorStage(s: string): s is AmbassadorStage {
  return STAGE_SET.has(s);
}

export function isLegalStageTransition(
  from: AmbassadorStage,
  to: AmbassadorStage
): boolean {
  return (LEGAL_TRANSITIONS[from] as readonly string[]).includes(to);
}

export function allowedNextStages(
  from: AmbassadorStage
): readonly AmbassadorStage[] {
  return LEGAL_TRANSITIONS[from];
}

function observationTypeForAdvance(
  newStage: AmbassadorStage
): ObservationType {
  if (newStage === "accepted") return "ambassador_accepted";
  if (newStage === "rejected") return "ambassador_rejected";
  return "ambassador_activity_logged";
}

export function mapAmbassadorRow(row: Record<string, unknown>): Ambassador {
  let score: Ambassador["score"];
  const rawScore = row.score;
  if (rawScore && typeof rawScore === "object" && !Array.isArray(rawScore)) {
    const s = rawScore as Record<string, unknown>;
    score = {
      research_alignment: Number(s.research_alignment ?? 0),
      student_reach: Number(s.student_reach ?? 0),
      adoption_signal: Number(s.adoption_signal ?? 0),
      network_influence: Number(s.network_influence ?? 0),
      total: Number(s.total ?? 0),
    };
  }

  let application_data: Record<string, unknown> = {};
  const rawApp = row.application_data;
  if (rawApp && typeof rawApp === "object" && !Array.isArray(rawApp)) {
    application_data = rawApp as Record<string, unknown>;
  }

  const stageRaw = row.stage as string;
  if (!isAmbassadorStage(stageRaw)) {
    throw new Error(`Invalid ambassador stage in row: ${stageRaw}`);
  }

  return {
    id: row.id as string,
    institution_id: row.institution_id as string,
    email: row.email as string,
    name: row.name as string,
    github_username: (row.github_username as string | null) ?? undefined,
    application_data,
    score,
    stage: stageRaw,
    health_score: Number(row.health_score ?? 0),
    accepted_at: (row.accepted_at as string | null) ?? undefined,
    last_active_at: (row.last_active_at as string | null) ?? undefined,
  };
}

export async function listObservationsForAmbassador(
  client: SupabaseClient,
  ambassadorId: string,
  options: { limit: number; ascending: boolean }
): Promise<Observation[]> {
  const { data, error } = await client
    .from("observations")
    .select("*")
    .eq("entity_type", "ambassador")
    .eq("entity_id", ambassadorId)
    .order("observed_at", { ascending: options.ascending })
    .limit(options.limit);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      entity_type: r.entity_type as Observation["entity_type"],
      entity_id: r.entity_id as string,
      observation_type: r.observation_type as Observation["observation_type"],
      payload: (r.payload as Record<string, unknown>) ?? {},
      source: r.source as Observation["source"],
      source_url: (r.source_url as string | null) ?? undefined,
      confidence: Number(r.confidence),
      observed_at: r.observed_at as string,
      created_at: r.created_at as string,
    };
  });
}

async function insertAmbassadorActivityRow(params: {
  ambassador_id: string;
  activity_type: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("ambassador_activity").insert({
    ambassador_id: params.ambassador_id,
    activity_type: params.activity_type,
    payload: params.payload,
  });
  if (error) throw error;
}

/**
 * Advance stage: observation → activity row → projection update.
 */
export async function advanceAmbassadorStage(
  ambassadorId: string,
  newStage: AmbassadorStage
): Promise<Ambassador> {
  const { data: row, error: loadErr } = await supabaseAdmin
    .from("ambassadors")
    .select("*")
    .eq("id", ambassadorId)
    .maybeSingle();

  if (loadErr) throw loadErr;
  if (!row) {
    throw new Error("Ambassador not found");
  }

  const current = mapAmbassadorRow(row as Record<string, unknown>);
  if (current.stage === newStage) {
    return current;
  }

  if (!isLegalStageTransition(current.stage, newStage)) {
    throw new Error(
      `Illegal stage transition: ${current.stage} → ${newStage}`
    );
  }

  const obsType = observationTypeForAdvance(newStage);
  await logObservation({
    entity_type: "ambassador",
    entity_id: ambassadorId,
    observation_type: obsType,
    payload: {
      from_stage: current.stage,
      to_stage: newStage,
      name: current.name,
    },
    source: "manual",
    confidence: 1.0,
  });

  await insertAmbassadorActivityRow({
    ambassador_id: ambassadorId,
    activity_type: "stage_changed",
    payload: { from_stage: current.stage, to_stage: newStage },
  });

  const patch: Record<string, unknown> = { stage: newStage };
  if (newStage === "accepted") {
    patch.accepted_at = new Date().toISOString();
  }

  const { data: updated, error: updErr } = await supabaseAdmin
    .from("ambassadors")
    .update(patch)
    .eq("id", ambassadorId)
    .select()
    .single();

  if (updErr || !updated) {
    throw new Error(updErr?.message ?? "Ambassador update failed");
  }

  return mapAmbassadorRow(updated as Record<string, unknown>);
}
