import Link from "next/link";
import {
  OutreachPipeline,
  type EnrichedTouchpoint,
} from "@/components/outreach/OutreachPipeline";
import { mapOutreachTouchpointRow } from "@/lib/outreach-generator";
import { createServerComponentClient } from "@/lib/supabase-server";
import { isProfessorLinkedTargetType } from "@/lib/types/outreach";

export default async function OutreachDashboardPage() {
  const supabase = await createServerComponentClient();

  const { data: rows, error } = await supabase
    .from("outreach_touchpoints")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="text-sm text-red-600">
        Could not load outreach: {error.message}
      </div>
    );
  }

  const touchpoints = (rows ?? []).map((r) =>
    mapOutreachTouchpointRow(r as Record<string, unknown>)
  );

  const profIds = [
    ...new Set(
      touchpoints
        .filter((t) => isProfessorLinkedTargetType(t.target_type))
        .map((t) => t.target_id)
    ),
  ];

  const instByProf = new Map<string, { id: string; name: string }>();
  if (profIds.length) {
    const { data: profs } = await supabase
      .from("professors")
      .select("id, institution_id")
      .in("id", profIds);
    const instIds = [
      ...new Set((profs ?? []).map((p) => p.institution_id as string)),
    ];
    const { data: insts } = await supabase
      .from("institutions")
      .select("id, name")
      .in("id", instIds);
    const instName = new Map(
      (insts ?? []).map((i) => [i.id as string, i.name as string])
    );
    for (const p of profs ?? []) {
      const iid = p.institution_id as string;
      instByProf.set(p.id as string, {
        id: iid,
        name: instName.get(iid) ?? iid,
      });
    }
  }

  const enriched: EnrichedTouchpoint[] = touchpoints.map((t) => {
    const meta = isProfessorLinkedTargetType(t.target_type)
      ? instByProf.get(t.target_id)
      : undefined;
    return {
      touchpoint: t,
      institutionId: meta?.id,
      institutionName: meta?.name,
    };
  });

  const { data: allInst } = await supabase
    .from("institutions")
    .select("id, name")
    .order("name");

  const institutionOptions =
    (allInst ?? []).map((i) => ({
      id: i.id as string,
      name: i.name as string,
    })) ?? [];

  return (
    <div className="space-y-6 max-w-[1600px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900 font-display">
            Outreach
          </h1>
          <p className="text-sm text-ink-500 mt-1">
            Fact-grounded touchpoints and pipeline stages.
          </p>
        </div>
        <Link
          href="/dashboard/outreach/new"
          className="text-sm px-3 py-1.5 rounded-lg bg-ink-900 text-white hover:bg-ink-800"
        >
          New touchpoint
        </Link>
      </div>

      <OutreachPipeline rows={enriched} institutionOptions={institutionOptions} />
    </div>
  );
}
