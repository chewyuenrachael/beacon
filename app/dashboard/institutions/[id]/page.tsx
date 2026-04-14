import Link from "next/link";
import { notFound } from "next/navigation";
import { subDays } from "date-fns";
import { createServerComponentClient } from "@/lib/supabase";
import {
  describeCoverageGaps,
  getInstitutionMetrics,
} from "@/lib/institution-metrics";
import { MetricCard } from "@/components/ui/MetricCard.forge";
import { Card } from "@/components/ui/Card";
import type { Observation, ObservationSource, ObservationType } from "@/lib/types";

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

export default async function InstitutionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const papersAsc = sp.sort === "papers_asc";

  const supabase = await createServerComponentClient();

  const { data: institution, error: instErr } = await supabase
    .from("institutions")
    .select("id,name,country")
    .eq("id", id)
    .maybeSingle();

  if (instErr || !institution) {
    notFound();
  }

  const metrics = await getInstitutionMetrics(id);

  let profQuery = supabase
    .from("professors")
    .select("id,name,recent_relevant_papers_count,last_enriched_at")
    .eq("institution_id", id);
  profQuery = papersAsc
    ? profQuery.order("recent_relevant_papers_count", { ascending: true })
    : profQuery.order("recent_relevant_papers_count", { ascending: false });
  profQuery = profQuery.order("name", { ascending: true });

  const { data: professors, error: pErr } = await profQuery;
  if (pErr) throw pErr;

  const { data: ambassadors, error: aErr } = await supabase
    .from("ambassadors")
    .select("id,name,email,stage,health_score,last_active_at")
    .eq("institution_id", id)
    .order("stage", { ascending: true });

  if (aErr) throw aErr;

  const sinceIso = subDays(new Date(), 30).toISOString();
  const profIds = (professors ?? []).map((r) => r.id as string);
  const ambIds = (ambassadors ?? []).map((r) => r.id as string);

  const [instObs, profObs, ambObs] = await Promise.all([
    supabase
      .from("observations")
      .select("*")
      .eq("entity_type", "institution")
      .eq("entity_id", id)
      .gte("observed_at", sinceIso)
      .order("observed_at", { ascending: false })
      .limit(80),
    profIds.length
      ? supabase
          .from("observations")
          .select("*")
          .eq("entity_type", "professor")
          .in("entity_id", profIds)
          .gte("observed_at", sinceIso)
          .order("observed_at", { ascending: false })
          .limit(80)
      : Promise.resolve({ data: [], error: null }),
    ambIds.length
      ? supabase
          .from("observations")
          .select("*")
          .eq("entity_type", "ambassador")
          .in("entity_id", ambIds)
          .gte("observed_at", sinceIso)
          .order("observed_at", { ascending: false })
          .limit(80)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (instObs.error) throw instObs.error;
  if (profObs.error) throw profObs.error;
  if (ambObs.error) throw ambObs.error;

  const timeline: Observation[] = [
    ...((instObs.data ?? []) as Record<string, unknown>[]).map(mapObservationRow),
    ...((profObs.data ?? []) as Record<string, unknown>[]).map(mapObservationRow),
    ...((ambObs.data ?? []) as Record<string, unknown>[]).map(mapObservationRow),
  ]
    .sort(
      (a, b) =>
        new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime()
    )
    .slice(0, 60);

  const gaps = describeCoverageGaps(metrics);
  const sortHref = papersAsc
    ? `/dashboard/institutions/${id}`
    : `/dashboard/institutions/${id}?sort=papers_asc`;
  const sortLabel = papersAsc
    ? "Sort: papers (low to high)"
    : "Sort: papers (high to low)";

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-2">
      <header className="space-y-1">
        <p className="text-xs text-text-tertiary uppercase tracking-wide">
          <Link href="/dashboard" className="hover:text-text-secondary">
            Campus intelligence
          </Link>
        </p>
        <h1 className="font-display text-2xl font-semibold text-text-primary">
          {institution.name}
        </h1>
        <p className="text-sm text-text-secondary">{institution.country}</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <MetricCard
          value={metrics.professor_count}
          label="Professors tracked"
          mono
        />
        <MetricCard
          value={metrics.avg_recent_relevant_papers.toFixed(1)}
          label="Avg recent relevant papers"
          mono
        />
        <MetricCard
          value={metrics.ambassador_active_count}
          label="Active ambassadors"
          mono
        />
        <MetricCard
          value={metrics.upcoming_events_count}
          label="Upcoming events"
          mono
        />
        <MetricCard
          value={metrics.total_observations_last_30d}
          label="Observations (30d)"
          mono
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card header="Top faculty by keyword signal">
          <ul className="space-y-2 text-sm">
            {metrics.top_3_professors_by_count.length === 0 ? (
              <li className="text-text-secondary">No professors on file.</li>
            ) : (
              metrics.top_3_professors_by_count.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between gap-2 text-text-primary"
                >
                  <Link
                    href={`/dashboard/professors/${p.id}`}
                    className="hover:text-accent-terracotta truncate"
                  >
                    {p.name}
                  </Link>
                  <span className="font-mono text-text-secondary shrink-0">
                    {p.recent_relevant_papers_count}
                  </span>
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card header="Coverage gaps">
          {gaps.length === 0 ? (
            <p className="text-sm text-text-secondary">
              No obvious gaps flagged for this snapshot.
            </p>
          ) : (
            <ul className="list-disc pl-4 space-y-1 text-sm text-text-secondary">
              {gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <Card
        header={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Professors</span>
            <Link
              href={sortHref}
              className="text-xs font-medium text-accent-terracotta hover:underline"
            >
              {sortLabel}
            </Link>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-tertiary border-b border-border-subtle">
                <th className="pb-2 pr-4 font-medium">Name</th>
                <th className="pb-2 pr-4 font-medium">Recent relevant papers</th>
                <th className="pb-2 font-medium">Last enriched</th>
              </tr>
            </thead>
            <tbody>
              {(professors ?? []).map((row) => (
                <tr
                  key={row.id as string}
                  className="border-b border-border-subtle/60 last:border-0"
                >
                  <td className="py-2 pr-4">
                    <Link
                      href={`/dashboard/professors/${row.id as string}`}
                      className="text-text-primary hover:text-accent-terracotta"
                    >
                      {row.name as string}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 font-mono tabular-nums">
                    {Number(row.recent_relevant_papers_count ?? 0)}
                  </td>
                  <td className="py-2 text-text-secondary text-xs">
                    {(row.last_enriched_at as string | null)
                      ? new Date(
                          row.last_enriched_at as string
                        ).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card header="Ambassadors">
        {(ambassadors ?? []).length === 0 ? (
          <p className="text-sm text-text-secondary">No ambassadors on file.</p>
        ) : (
          <ul className="divide-y divide-border-subtle/80">
            {(ambassadors ?? []).map((a) => (
              <li
                key={a.id as string}
                className="py-2 flex flex-wrap gap-2 justify-between text-sm"
              >
                <div>
                  <Link
                    href={`/dashboard/ambassadors/${a.id as string}`}
                    className="font-medium text-text-primary hover:text-accent-terracotta"
                  >
                    {a.name as string}
                  </Link>
                  <span className="text-text-tertiary text-xs block">
                    {a.email as string}
                  </span>
                </div>
                <div className="text-xs text-text-secondary space-x-2">
                  <span className="uppercase tracking-wide">{a.stage as string}</span>
                  <span className="font-mono">health {Number(a.health_score)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card header="Observation timeline (last 30 days)">
        {timeline.length === 0 ? (
          <p className="text-sm text-text-secondary">No observations in range.</p>
        ) : (
          <ol className="space-y-3 text-sm border-l border-border-subtle pl-4 ml-1">
            {timeline.map((o) => (
              <li key={o.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-border-strong" />
                <p className="text-xs text-text-tertiary">
                  {new Date(o.observed_at).toLocaleString()} ·{" "}
                  <span className="text-text-secondary">{o.observation_type}</span>{" "}
                  · {o.entity_type}{" "}
                  <code className="text-[11px]">{o.entity_id}</code>
                </p>
                <p className="text-text-primary mt-0.5 line-clamp-2">
                  {JSON.stringify(o.payload).slice(0, 160)}
                  {JSON.stringify(o.payload).length > 160 ? "…" : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
