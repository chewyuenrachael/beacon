import Link from "next/link";

import { DhvcTable } from "@/components/dhvc/DhvcTable";
import { RefreshSourcesButton } from "@/components/dhvc/RefreshSourcesButton";
import { mapDhvcCandidateRow } from "@/lib/dhvc-orchestrator";
import { createServerComponentClient } from "@/lib/supabase-server";
import {
  DHVC_REVIEW_STAGES,
  DHVC_SOURCES,
  type DhvcReviewStage,
  type DhvcSource,
} from "@/lib/types";

type SortKey = "score" | "discovered_at" | "institution";

const TAB_STAGES: ReadonlyArray<{ stage: DhvcReviewStage; label: string }> = [
  { stage: "pending_review", label: "Pending Review" },
  { stage: "accepted", label: "Accepted" },
  { stage: "rejected", label: "Rejected" },
];

function isReviewStage(s: string | undefined): s is DhvcReviewStage {
  return !!s && (DHVC_REVIEW_STAGES as readonly string[]).includes(s);
}

function isSource(s: string | undefined): s is DhvcSource {
  return !!s && (DHVC_SOURCES as readonly string[]).includes(s);
}

function isSortKey(s: string | undefined): s is SortKey {
  return s === "score" || s === "discovered_at" || s === "institution";
}

export default async function DhvcListPage({
  searchParams,
}: {
  searchParams: Promise<{
    stage?: string;
    institution_id?: string;
    primary_source?: string;
    min_score?: string;
    grad_year?: string;
    sort?: string;
  }>;
}) {
  const sp = await searchParams;
  const stage: DhvcReviewStage = isReviewStage(sp.stage)
    ? sp.stage
    : "pending_review";
  const sourceFilter = isSource(sp.primary_source) ? sp.primary_source : undefined;
  const instFilter = sp.institution_id?.trim() || undefined;
  const minScore =
    sp.min_score && Number.isFinite(Number(sp.min_score))
      ? Math.max(0, Math.min(100, Number(sp.min_score)))
      : undefined;
  const gradYear =
    sp.grad_year && Number.isFinite(Number(sp.grad_year))
      ? Number(sp.grad_year)
      : undefined;
  const sort: SortKey = isSortKey(sp.sort) ? sp.sort : "score";

  const supabase = await createServerComponentClient();

  let query = supabase.from("dhvc_candidates").select("*").eq(
    "review_stage",
    stage
  );
  if (sourceFilter) query = query.eq("primary_source", sourceFilter);
  if (instFilter) query = query.eq("institution_id", instFilter);
  if (gradYear !== undefined) query = query.eq("graduation_year", gradYear);
  if (minScore !== undefined) {
    query = query.gte("score->>total", String(minScore));
  }

  const { data: rows, error } = await query;

  if (error) {
    return (
      <p className="text-sm text-text-secondary">
        Failed to load DHVC candidates: {error.message}
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

  let candidates = (rows ?? []).map((r) =>
    mapDhvcCandidateRow(r as Record<string, unknown>)
  );

  candidates = [...candidates].sort((a, b) => {
    if (sort === "discovered_at") {
      return (
        new Date(b.discovered_at).getTime() -
        new Date(a.discovered_at).getTime()
      );
    }
    if (sort === "institution") {
      const ai = instMap[a.institution_id] ?? a.institution_id;
      const bi = instMap[b.institution_id] ?? b.institution_id;
      return ai.localeCompare(bi);
    }
    return (b.score?.total ?? 0) - (a.score?.total ?? 0);
  });

  const tableRows = candidates.map((c) => ({
    candidate: c,
    institutionName: instMap[c.institution_id] ?? c.institution_id,
  }));

  const sourceOptions = [
    { value: "", label: "All sources" },
    ...DHVC_SOURCES.map((s) => ({ value: s, label: s })),
  ];

  const instOptions = [
    { value: "", label: "All institutions" },
    ...(institutions ?? []).map((i) => ({
      value: i.id as string,
      label: i.name as string,
    })),
  ];

  const sortOptions: { value: SortKey; label: string }[] = [
    { value: "score", label: "Score (desc)" },
    { value: "discovered_at", label: "Recently discovered" },
    { value: "institution", label: "Institution" },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary font-display">
            DHVC Candidates
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Disproportionately High-Value Candidates · curation queue
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/dhvc/new"
            className="inline-flex items-center justify-center rounded-md font-medium h-9 px-4 text-sm border border-[#D0CCC4] text-text-primary hover:bg-[#F0EDE6] transition-colors"
          >
            Add candidate
          </Link>
          <RefreshSourcesButton />
        </div>
      </header>

      <nav className="flex items-center gap-1 border-b border-border-subtle">
        {TAB_STAGES.map((t) => {
          const active = t.stage === stage;
          const search = new URLSearchParams();
          search.set("stage", t.stage);
          if (sourceFilter) search.set("primary_source", sourceFilter);
          if (instFilter) search.set("institution_id", instFilter);
          if (minScore !== undefined) search.set("min_score", String(minScore));
          if (gradYear !== undefined) search.set("grad_year", String(gradYear));
          search.set("sort", sort);
          return (
            <Link
              key={t.stage}
              href={`/dashboard/dhvc?${search.toString()}`}
              className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
                active
                  ? "border-[#C45A3C] text-text-primary font-medium"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 p-4 bg-white border border-[#D0CCC4] rounded-md"
      >
        <input type="hidden" name="stage" value={stage} />
        <div>
          <label className="block text-xs uppercase tracking-wider text-text-secondary font-medium mb-1.5">
            Source
          </label>
          <select
            name="primary_source"
            defaultValue={sourceFilter ?? ""}
            className="h-9 min-w-[140px] rounded-md border border-[#D0CCC4] bg-white px-3 text-sm text-text-primary"
          >
            {sourceOptions.map((o) => (
              <option key={o.value || "all-source"} value={o.value}>
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
            Min score
          </label>
          <input
            name="min_score"
            type="number"
            min={0}
            max={100}
            defaultValue={minScore ?? ""}
            className="h-9 w-24 rounded-md border border-[#D0CCC4] bg-white px-3 text-sm text-text-primary"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-text-secondary font-medium mb-1.5">
            Grad year
          </label>
          <input
            name="grad_year"
            type="number"
            min={1900}
            max={2100}
            defaultValue={gradYear ?? ""}
            className="h-9 w-28 rounded-md border border-[#D0CCC4] bg-white px-3 text-sm text-text-primary"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-text-secondary font-medium mb-1.5">
            Sort by
          </label>
          <select
            name="sort"
            defaultValue={sort}
            className="h-9 min-w-[180px] rounded-md border border-[#D0CCC4] bg-white px-3 text-sm text-text-primary"
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
          className="inline-flex items-center justify-center rounded-md font-medium h-9 px-4 text-sm border border-[#D0CCC4] text-text-primary hover:bg-[#F0EDE6] transition-colors"
        >
          Apply filters
        </button>
      </form>

      <DhvcTable rows={tableRows} />
    </div>
  );
}
