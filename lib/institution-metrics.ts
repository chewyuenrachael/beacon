import { subDays } from "date-fns";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { InstitutionMetrics, InstitutionProfessorSummary } from "@/lib/types/intelligence";

/**
 * Roll-up metrics for the Campus Intelligence institution view.
 */
export async function getInstitutionMetrics(
  institutionId: string
): Promise<InstitutionMetrics> {
  const sinceIso = subDays(new Date(), 30).toISOString();
  const nowIso = new Date().toISOString();

  const [profResult, ambCountResult, ambActiveResult, evResult, ambIdsResult] =
    await Promise.all([
      supabaseAdmin
        .from("professors")
        .select("id,name,recent_relevant_papers_count")
        .eq("institution_id", institutionId),
      supabaseAdmin
        .from("ambassadors")
        .select("id", { count: "exact", head: true })
        .eq("institution_id", institutionId),
      supabaseAdmin
        .from("ambassadors")
        .select("id", { count: "exact", head: true })
        .eq("institution_id", institutionId)
        .eq("stage", "active"),
      supabaseAdmin
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("institution_id", institutionId)
        .in("status", ["draft", "scheduled"])
        .gte("scheduled_at", nowIso),
      supabaseAdmin
        .from("ambassadors")
        .select("id")
        .eq("institution_id", institutionId),
    ]);

  if (profResult.error) throw profResult.error;
  if (ambCountResult.error) throw ambCountResult.error;
  if (ambActiveResult.error) throw ambActiveResult.error;
  if (evResult.error) throw evResult.error;
  if (ambIdsResult.error) throw ambIdsResult.error;

  const professors = (profResult.data ?? []) as InstitutionProfessorSummary[];
  const professor_count = professors.length;
  const sumPapers = professors.reduce(
    (s, p) => s + Number(p.recent_relevant_papers_count ?? 0),
    0
  );
  const avg_recent_relevant_papers =
    professor_count === 0 ? 0 : sumPapers / professor_count;

  const top_3_professors_by_count = [...professors]
    .sort((a, b) => {
      const d =
        Number(b.recent_relevant_papers_count) -
        Number(a.recent_relevant_papers_count);
      if (d !== 0) return d;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 3);

  const profIds = professors.map((p) => p.id);
  const ambassadorIds = (ambIdsResult.data ?? []).map((r) => r.id as string);

  // POST-DEMO TODO: observation rollup uses O(entities per institution) filter breadth
  // (.in lists grow with faculty/ambassador counts). Revisit query shape or materialized
  // rollups when institution count > 10 or per-institution professor count > 50.
  const [instObs, profObs, ambObs] = await Promise.all([
    supabaseAdmin
      .from("observations")
      .select("id", { count: "exact", head: true })
      .eq("entity_type", "institution")
      .eq("entity_id", institutionId)
      .gte("observed_at", sinceIso),
    profIds.length
      ? supabaseAdmin
          .from("observations")
          .select("id", { count: "exact", head: true })
          .eq("entity_type", "professor")
          .in("entity_id", profIds)
          .gte("observed_at", sinceIso)
      : Promise.resolve({ count: 0, error: null }),
    ambassadorIds.length
      ? supabaseAdmin
          .from("observations")
          .select("id", { count: "exact", head: true })
          .eq("entity_type", "ambassador")
          .in("entity_id", ambassadorIds)
          .gte("observed_at", sinceIso)
      : Promise.resolve({ count: 0, error: null }),
  ]);

  if (instObs.error) throw instObs.error;
  if (profObs.error) throw profObs.error;
  if (ambObs.error) throw ambObs.error;

  const total_observations_last_30d =
    (instObs.count ?? 0) + (profObs.count ?? 0) + (ambObs.count ?? 0);

  return {
    institution_id: institutionId,
    professor_count,
    avg_recent_relevant_papers,
    top_3_professors_by_count,
    ambassador_count: ambCountResult.count ?? 0,
    ambassador_active_count: ambActiveResult.count ?? 0,
    upcoming_events_count: evResult.count ?? 0,
    total_observations_last_30d,
  };
}

/** Human-readable coverage gaps for institution detail UI */
export function describeCoverageGaps(m: InstitutionMetrics): string[] {
  const gaps: string[] = [];
  if (m.ambassador_active_count === 0) {
    gaps.push("No active campus ambassador on file.");
  }
  if (m.upcoming_events_count === 0) {
    gaps.push("No upcoming events scheduled for this campus.");
  }
  if (
    m.professor_count > 0 &&
    m.avg_recent_relevant_papers === 0
  ) {
    gaps.push(
      "Faculty keyword signal is flat (average recent relevant papers is zero — run enrichment or verify arXiv coverage)."
    );
  }
  return gaps;
}
