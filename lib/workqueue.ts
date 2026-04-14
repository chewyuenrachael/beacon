import { addDays } from "date-fns";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  getInstitutionMetrics,
  describeCoverageGaps,
} from "@/lib/institution-metrics";
import type {
  WorkqueueCandidate,
  WorkqueueItem,
  WorkqueueSourceFeature,
} from "@/lib/types/intelligence";

/** Lower sorts earlier when priority_score ties (first wins in ranked list). */
const SOURCE_TIE_ORDER: Record<WorkqueueSourceFeature, number> = {
  discount: 0,
  ambassador: 1,
  outreach: 2,
  events: 3,
  coverage: 4,
  intelligence: 5,
};

/**
 * Pure ordering + cap for Monday workqueue. Tests target this function with
 * synthetic candidates (no Supabase).
 */
export function rankWorkqueueCandidates(
  candidates: WorkqueueCandidate[],
  maxItems = 10
): WorkqueueItem[] {
  const sorted = [...candidates].sort((a, b) => {
    if (b.priority_score !== a.priority_score) {
      return b.priority_score - a.priority_score;
    }
    const s =
      SOURCE_TIE_ORDER[a.source_feature] - SOURCE_TIE_ORDER[b.source_feature];
    if (s !== 0) return s;
    return a.id.localeCompare(b.id);
  });

  return sorted.slice(0, maxItems).map((c) => ({ ...c }));
}

function mapVerificationInstitutionId(row: {
  claimed_institution: string | null;
  email: string | null;
}): string | null {
  const c = row.claimed_institution?.toLowerCase() ?? "";
  if (c.includes("stanford")) return "stanford";
  if (c.includes("oxford")) return "oxford";
  if (c.includes("bucharest")) return null;
  if (c.includes("iit")) return null;

  const e = row.email?.toLowerCase() ?? "";
  if (e.endsWith(".stanford.edu") || e.includes("stanford")) return "stanford";
  if (e.endsWith(".ox.ac.uk")) return "oxford";
  return null;
}

const STRATEGIC_CAMPUSES = [
  "mit",
  "stanford",
  "cmu",
  "berkeley",
  "columbia",
] as const;

export async function generateWorkqueue(): Promise<WorkqueueItem[]> {
  const candidates: WorkqueueCandidate[] = [];

  const { data: verRows, error: verErr } = await supabaseAdmin
    .from("verification_attempts")
    .select("id,email,claimed_institution,status,country")
    .in("status", ["pending", "manual_review"])
    .order("created_at", { ascending: false })
    .limit(12);

  if (!verErr && verRows) {
    for (const v of verRows) {
      const inst = mapVerificationInstitutionId({
        claimed_institution: (v.claimed_institution as string | null) ?? null,
        email: (v.email as string | null) ?? null,
      });
      if (!inst) continue;

      const isManual = v.status === "manual_review";
      const priority_score = isManual ? 96 : 84;
      const title = isManual
        ? `SheerID manual review: ${v.email as string}`
        : `SheerID pending: ${v.email as string}`;
      const description = [
        v.country as string,
        (v.claimed_institution as string | null) ?? "unknown institution",
      ]
        .filter(Boolean)
        .join(" · ");

      candidates.push({
        id: `verify-${v.id as string}`,
        priority_score,
        title,
        description,
        action_url: "/dashboard/discount/queue",
        action_label: "Open queue",
        source_feature: "discount",
        mark_complete: { entity_type: "institution", entity_id: inst },
      });
    }
  }

  const { data: ambRows, error: ambErr } = await supabaseAdmin
    .from("ambassadors")
    .select("id,name,email,institution_id,stage,score")
    .in("stage", ["applied", "under_review"])
    .order("id", { ascending: true })
    .limit(12);

  if (!ambErr && ambRows) {
    for (const a of ambRows) {
      const stage = a.stage as string;
      const priority_score = stage === "under_review" ? 81 : 78;
      const total = (a.score as { total?: number } | null)?.total;
      const scoreHint =
        typeof total === "number" ? ` · score ${total}` : "";
      candidates.push({
        id: `amb-${a.id as string}`,
        priority_score,
        title: `Ambassador pipeline: ${a.name as string}`,
        description: `${a.email as string} (${stage})${scoreHint}`,
        action_url: `/dashboard/ambassadors/${a.id as string}`,
        action_label: "Review application",
        source_feature: "ambassador",
        mark_complete: {
          entity_type: "ambassador",
          entity_id: a.id as string,
        },
      });
    }
  }

  let professorsWithOutreach: Set<string> | null = null;
  try {
    const { data: tp, error: tpErr } = await supabaseAdmin
      .from("outreach_touchpoints")
      .select("target_id")
      .eq("target_type", "professor");
    if (tpErr) throw tpErr;
    professorsWithOutreach = new Set(
      (tp ?? []).map((r) => r.target_id as string)
    );
  } catch {
    professorsWithOutreach = null;
  }

  if (professorsWithOutreach) {
    const { data: profs, error: pErr } = await supabaseAdmin
      .from("professors")
      .select("id,name,institution_id,recent_relevant_papers_count")
      .gte("recent_relevant_papers_count", 4)
      .order("recent_relevant_papers_count", { ascending: false })
      .limit(20);

    if (!pErr && profs) {
      for (const p of profs) {
        const pid = p.id as string;
        if (professorsWithOutreach.has(pid)) continue;
        const cnt = Number(p.recent_relevant_papers_count ?? 0);
        candidates.push({
          id: `outreach-${pid}`,
          priority_score: 68 + Math.min(cnt, 12) * 0.35,
          title: `Faculty outreach: ${p.name as string}`,
          description:
            "High keyword-visible paper volume and no outreach touchpoint logged yet.",
          action_url: `/dashboard/professors/${pid}`,
          action_label: "Open professor",
          source_feature: "outreach",
          mark_complete: { entity_type: "professor", entity_id: pid },
        });
      }
    }
  }

  const horizon = addDays(new Date(), 14).toISOString();
  const nowIso = new Date().toISOString();
  const { data: evRows, error: evErr } = await supabaseAdmin
    .from("events")
    .select("id,title,institution_id,scheduled_at,status")
    .in("status", ["draft", "scheduled"])
    .gte("scheduled_at", nowIso)
    .lte("scheduled_at", horizon)
    .order("scheduled_at", { ascending: true })
    .limit(10);

  if (!evErr && evRows) {
    for (const ev of evRows) {
      const when = ev.scheduled_at
        ? new Date(ev.scheduled_at as string).toISOString().slice(0, 10)
        : "TBD";
      const days =
        ev.scheduled_at != null
          ? Math.max(
              0,
              Math.ceil(
                (new Date(ev.scheduled_at as string).getTime() - Date.now()) /
                  86400000
              )
            )
          : 7;
      const urgency = days <= 3 ? 74 : 61;
      candidates.push({
        id: `evt-${ev.id as string}`,
        priority_score: urgency,
        title: `Upcoming event: ${ev.title as string}`,
        description: `Scheduled ${when} · status ${ev.status as string}`,
        action_url: `/dashboard/events/${ev.id as string}`,
        action_label: "Open event",
        source_feature: "events",
        mark_complete: {
          entity_type: "institution",
          entity_id: ev.institution_id as string,
        },
      });
    }
  }

  for (const instId of STRATEGIC_CAMPUSES) {
    const m = await getInstitutionMetrics(instId);
    const gaps = describeCoverageGaps(m);
    if (gaps.length === 0) continue;
    candidates.push({
      id: `cov-${instId}`,
      priority_score: 54 - gaps.length * 0.5,
      title: `Coverage: ${instId.toUpperCase()}`,
      description: gaps.slice(0, 2).join(" "),
      action_url: `/dashboard/institutions/${instId}`,
      action_label: "View campus",
      source_feature: "coverage",
      mark_complete: { entity_type: "institution", entity_id: instId },
    });
  }

  const staleProf = await supabaseAdmin
    .from("professors")
    .select("id,name,last_enriched_at,recent_relevant_papers_count")
    .is("last_enriched_at", null)
    .order("recent_relevant_papers_count", { ascending: false })
    .limit(8);

  if (!staleProf.error && staleProf.data) {
    for (const p of staleProf.data) {
      candidates.push({
        id: `intel-${p.id as string}`,
        priority_score: 50,
        title: `Enrichment backlog: ${p.name as string}`,
        description:
          "Professor row has not been enriched yet (no last_enriched_at).",
        action_url: `/dashboard/professors/${p.id as string}`,
        action_label: "Open professor",
        source_feature: "intelligence",
        mark_complete: { entity_type: "professor", entity_id: p.id as string },
      });
    }
  }

  return rankWorkqueueCandidates(candidates, 10);
}
