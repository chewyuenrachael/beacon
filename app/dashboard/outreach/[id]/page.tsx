import Link from "next/link";
import { OutreachDetailClient } from "./OutreachDetailClient";
import { mapOutreachTouchpointRow } from "@/lib/outreach-generator";
import { createServerComponentClient } from "@/lib/supabase";
import type { Observation } from "@/lib/types";
import { isProfessorLinkedTargetType } from "@/lib/types/outreach";

export default async function OutreachDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerComponentClient();

  const { data: row, error } = await supabase
    .from("outreach_touchpoints")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    return (
      <div className="text-sm text-ink-500">
        Touchpoint not found{error ? `: ${error.message}` : ""}.
      </div>
    );
  }

  const touchpoint = mapOutreachTouchpointRow(row as Record<string, unknown>);

  let professor: Record<string, unknown> | null = null;
  if (isProfessorLinkedTargetType(touchpoint.target_type)) {
    const { data: prof } = await supabase
      .from("professors")
      .select("*")
      .eq("id", touchpoint.target_id)
      .maybeSingle();
    if (prof) professor = prof as Record<string, unknown>;
  }

  const { data: obsRows } = await supabase
    .from("observations")
    .select("*")
    .eq("entity_type", "outreach")
    .eq("entity_id", id)
    .order("observed_at", { ascending: false })
    .limit(50);

  const observations = (obsRows ?? []).map((o) => ({
    id: o.id as string,
    entity_type: o.entity_type as Observation["entity_type"],
    entity_id: o.entity_id as string,
    observation_type: o.observation_type as Observation["observation_type"],
    payload: (o.payload as Record<string, unknown>) ?? {},
    source: o.source as Observation["source"],
    source_url: (o.source_url as string | undefined) ?? undefined,
    confidence: Number(o.confidence),
    observed_at: o.observed_at as string,
    created_at: o.created_at as string,
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/outreach"
        className="text-xs text-ink-500 hover:text-ink-700 inline-block"
      >
        ← Outreach
      </Link>
      <header>
        <h1 className="text-2xl font-semibold text-ink-900 font-display">
          {touchpoint.target_name}
        </h1>
        <p className="text-sm text-ink-500 mt-1">
          {touchpoint.target_type.replace(/_/g, " ")} · {touchpoint.target_id} ·{" "}
          {touchpoint.channel}
        </p>
      </header>

      <OutreachDetailClient
        touchpoint={touchpoint}
        professor={professor}
        observations={observations}
      />
    </div>
  );
}
