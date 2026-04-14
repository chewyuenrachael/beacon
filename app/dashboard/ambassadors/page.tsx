import Link from "next/link";
import { AmbassadorTable } from "@/components/ambassadors/AmbassadorTable";
import { mapAmbassadorRow } from "@/lib/ambassador-pipeline";
import { createServerComponentClient } from "@/lib/supabase-server";
import type { AmbassadorStage } from "@/lib/types";
import { AMBASSADOR_STAGES } from "@/lib/types";

type SortKey = "score" | "last_active_at" | "accepted_at";

function isSortKey(s: string | undefined): s is SortKey {
  return s === "score" || s === "last_active_at" || s === "accepted_at";
}

function isStage(s: string | undefined): s is AmbassadorStage {
  return !!s && (AMBASSADOR_STAGES as readonly string[]).includes(s);
}

export default async function AmbassadorsListPage({
  searchParams,
}: {
  searchParams: Promise<{
    stage?: string;
    institution_id?: string;
    sort?: string;
  }>;
}) {
  const sp = await searchParams;
  const sort: SortKey = isSortKey(sp.sort) ? sp.sort : "last_active_at";
  const stageFilter = isStage(sp.stage) ? sp.stage : undefined;
  const instFilter = sp.institution_id?.trim() || undefined;

  const supabase = await createServerComponentClient();

  let query = supabase.from("ambassadors").select("*");
  if (stageFilter) {
    query = query.eq("stage", stageFilter);
  }
  if (instFilter) {
    query = query.eq("institution_id", instFilter);
  }

  const { data: rows, error } = await query;

  if (error) {
    return (
      <p className="text-sm text-text-secondary">
        Failed to load ambassadors: {error.message}
      </p>
    );
  }

  const { data: institutions } = await supabase
    .from("institutions")
    .select("id, name")
    .order("name");

  const instMap = Object.fromEntries(
    (institutions ?? []).map((i) => [i.id as string, i.name as string])
  );

  let ambassadors = (rows ?? []).map((r) =>
    mapAmbassadorRow(r as Record<string, unknown>)
  );

  ambassadors = [...ambassadors].sort((a, b) => {
    if (sort === "score") {
      return (b.score?.total ?? 0) - (a.score?.total ?? 0);
    }
    if (sort === "accepted_at") {
      const ta = a.accepted_at ? new Date(a.accepted_at).getTime() : 0;
      const tb = b.accepted_at ? new Date(b.accepted_at).getTime() : 0;
      return tb - ta;
    }
    const ta = a.last_active_at
      ? new Date(a.last_active_at).getTime()
      : Number.NEGATIVE_INFINITY;
    const tb = b.last_active_at
      ? new Date(b.last_active_at).getTime()
      : Number.NEGATIVE_INFINITY;
    return tb - ta;
  });

  const tableRows = ambassadors.map((a) => ({
    ambassador: a,
    institutionName: instMap[a.institution_id] ?? a.institution_id,
  }));

  const stageOptions = [
    { value: "", label: "All stages" },
    ...AMBASSADOR_STAGES.map((s) => ({
      value: s,
      label: s.replace(/_/g, " "),
    })),
  ];

  const instOptions = [
    { value: "", label: "All institutions" },
    ...(institutions ?? []).map((i) => ({
      value: i.id as string,
      label: i.name as string,
    })),
  ];

  const sortOptions: { value: SortKey; label: string }[] = [
    { value: "last_active_at", label: "Last active" },
    { value: "score", label: "Score" },
    { value: "accepted_at", label: "Accepted at" },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary font-display">
            Ambassadors
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Pipeline, scores, and activity
          </p>
        </div>
        <Link
          href="/dashboard/ambassadors/new"
          className="inline-flex items-center justify-center rounded-md font-medium h-9 px-4 text-sm bg-[#1A1A1A] text-white hover:bg-[#333330] transition-colors focus:outline-none focus:ring-2 focus:ring-[#C45A3C]/30"
        >
          New application
        </Link>
      </header>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 p-4 bg-white border border-[#D0CCC4] rounded-md"
      >
        <div>
          <label className="block text-xs uppercase tracking-wider text-text-secondary font-medium mb-1.5">
            Stage
          </label>
          <select
            name="stage"
            defaultValue={stageFilter ?? ""}
            className="h-9 min-w-[160px] rounded-md border border-[#D0CCC4] bg-white px-3 text-sm text-text-primary"
          >
            {stageOptions.map((o) => (
              <option key={o.value || "all-stage"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-text-secondary font-medium mb-1.5">
            Institution
          </label>
          <select
            name="institution_id"
            defaultValue={instFilter ?? ""}
            className="h-9 min-w-[200px] rounded-md border border-[#D0CCC4] bg-white px-3 text-sm text-text-primary"
          >
            {instOptions.map((o) => (
              <option key={o.value || "all-inst"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-text-secondary font-medium mb-1.5">
            Sort by
          </label>
          <select
            name="sort"
            defaultValue={sort}
            className="h-9 min-w-[160px] rounded-md border border-[#D0CCC4] bg-white px-3 text-sm text-text-primary"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md font-medium h-9 px-4 text-sm border border-[#D0CCC4] text-text-primary hover:bg-[#F0EDE6] transition-colors focus:outline-none focus:ring-2 focus:ring-[#C45A3C]/30"
        >
          Apply filters
        </button>
      </form>

      <AmbassadorTable rows={tableRows} />
    </div>
  );
}
