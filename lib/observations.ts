import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type {
  Observation,
  ObservationSource,
  ObservationType,
} from "@/lib/types";

function mapObservationRow(row: Record<string, unknown>): Observation {
  return {
    id: row.id as string,
    entity_type: row.entity_type as Observation["entity_type"],
    entity_id: row.entity_id as string,
    observation_type: row.observation_type as ObservationType,
    payload: (row.payload as Record<string, unknown>) ?? {},
    source: row.source as ObservationSource,
    source_url: (row.source_url as string | null) ?? undefined,
    confidence: Number(row.confidence),
    observed_at: row.observed_at as string,
    created_at: row.created_at as string,
  };
}

/**
 * Append-only observation write (service role).
 */
export async function logObservation(params: {
  entity_type: Observation["entity_type"];
  entity_id: string;
  observation_type: ObservationType;
  payload: Record<string, unknown>;
  source: ObservationSource;
  source_url?: string;
  confidence: number;
}): Promise<Observation> {
  const { data, error } = await supabaseAdmin
    .from("observations")
    .insert({
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      observation_type: params.observation_type,
      payload: params.payload,
      source: params.source,
      source_url: params.source_url ?? null,
      confidence: params.confidence,
    })
    .select()
    .single();

  if (error) throw error;
  return mapObservationRow(data as Record<string, unknown>);
}

/**
 * Read observations for a professor (anon or service client).
 */
export async function listObservationsForProfessor(
  client: SupabaseClient,
  professorId: string,
  options: { limit: number; ascending: boolean }
): Promise<Observation[]> {
  const q = client
    .from("observations")
    .select("*")
    .eq("entity_type", "professor")
    .eq("entity_id", professorId)
    .order("observed_at", { ascending: options.ascending })
    .limit(options.limit);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((row) =>
    mapObservationRow(row as Record<string, unknown>)
  );
}
