import Link from "next/link";
import { subDays } from "date-fns";
import { createServerComponentClient } from "@/lib/supabase-server";
import { listResources } from "@/lib/resource-content";
import { MetricCard } from "@/components/ui/MetricCard.forge";
import { Card } from "@/components/ui/Card";

type ViewRow = {
  resource_slug: string;
  viewed_at: string;
  time_on_page_seconds: number | null;
};

export default async function ResourceAnalyticsPage() {
  const supabase = await createServerComponentClient();
  const catalog = await listResources();
  const catalogSlugs = new Set(catalog.map((r) => r.slug));

  const { data: rows, error } = await supabase
    .from("resource_views")
    .select("resource_slug, viewed_at, time_on_page_seconds");

  if (error) {
    return (
      <div className="max-w-3xl space-y-4">
        <Link
          href="/dashboard/resources"
          className="text-sm text-ink-500 hover:text-accent-terracotta"
        >
          ← Resources
        </Link>
        <p className="text-sm text-ink-700">
          Could not load analytics ({error.message}). Apply migration{" "}
          <code className="text-xs bg-cream-100 px-1 rounded">004_resources.sql</code>{" "}
          if this table is missing.
        </p>
      </div>
    );
  }

  const list = (rows ?? []) as ViewRow[];
  const cutoff = subDays(new Date(), 30);

  const viewsAllTime: Record<string, number> = {};
  const views30d: Record<string, number> = {};
  const lastViewed = new Map<string, Date>();
  const dwellAgg = new Map<string, { sum: number; n: number }>();

  for (const row of list) {
    viewsAllTime[row.resource_slug] =
      (viewsAllTime[row.resource_slug] ?? 0) + 1;
    const viewedAt = new Date(row.viewed_at);
    if (viewedAt >= cutoff) {
      views30d[row.resource_slug] = (views30d[row.resource_slug] ?? 0) + 1;
    }
    const prev = lastViewed.get(row.resource_slug);
    if (!prev || viewedAt > prev) lastViewed.set(row.resource_slug, viewedAt);
    if (row.time_on_page_seconds != null) {
      const d = dwellAgg.get(row.resource_slug) ?? { sum: 0, n: 0 };
      d.sum += row.time_on_page_seconds;
      d.n += 1;
      dwellAgg.set(row.resource_slug, d);
    }
  }

  const deadSlugs = [...catalogSlugs].filter((slug) => {
    const last = lastViewed.get(slug);
    if (!last) return true;
    return last < cutoff;
  });

  const rankedAllTime = Object.entries(viewsAllTime)
    .filter(([slug]) => catalogSlugs.has(slug))
    .sort((a, b) => b[1] - a[1]);

  const ranked30d = Object.entries(views30d)
    .filter(([slug]) => catalogSlugs.has(slug))
    .sort((a, b) => b[1] - a[1]);

  const topDwell = [...dwellAgg.entries()]
    .filter(([slug]) => catalogSlugs.has(slug))
    .map(([slug, { sum, n }]) => ({
      slug,
      avg: n > 0 ? Math.round(sum / n) : 0,
      samples: n,
    }))
    .filter((x) => x.samples > 0)
    .sort((a, b) => b.avg - a.avg);

  const totalViews = list.length;
  const dwellValues = list
    .map((r) => r.time_on_page_seconds)
    .filter((x): x is number => x != null);
  const overallAvgDwell =
    dwellValues.length > 0
      ? Math.round(
          dwellValues.reduce((a, b) => a + b, 0) / dwellValues.length
        )
      : 0;

  const titleBySlug = new Map(catalog.map((r) => [r.slug, r.title]));

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard/resources"
            className="text-sm text-ink-500 hover:text-accent-terracotta"
          >
            ← Resources
          </Link>
          <h1 className="text-2xl font-semibold text-ink-900 font-display mt-2">
            Resource analytics
          </h1>
          <p className="text-sm text-ink-500 mt-1">
            View counts and time-on-page from{" "}
            <code className="text-xs bg-cream-100 px-1 rounded">resource_views</code>.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard value={totalViews} label="Total logged views" mono />
        <MetricCard
          value={deadSlugs.length}
          label="Resources with no views in 30 days"
          mono
        />
        <MetricCard
          value={overallAvgDwell}
          label="Avg time on page (seconds, when reported)"
          mono
        />
        <MetricCard
          value={catalogSlugs.size}
          label="Resources in catalog"
          mono
        />
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card header="Top resources by views (all time)">
          {rankedAllTime.length === 0 ? (
            <p className="text-sm text-ink-500">No views recorded yet.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {rankedAllTime.slice(0, 15).map(([slug, n], i) => (
                <li
                  key={slug}
                  className="flex justify-between gap-4 border-b border-cream-100 pb-2 last:border-0"
                >
                  <span className="text-ink-600">
                    <span className="text-ink-400 mr-2">{i + 1}.</span>
                    {titleBySlug.get(slug) ?? slug}
                  </span>
                  <span className="font-mono text-ink-900 tabular-nums shrink-0">
                    {n}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card header="Top resources by views (last 30 days)">
          {ranked30d.length === 0 ? (
            <p className="text-sm text-ink-500">No views in the last 30 days.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {ranked30d.slice(0, 15).map(([slug, n], i) => (
                <li
                  key={slug}
                  className="flex justify-between gap-4 border-b border-cream-100 pb-2 last:border-0"
                >
                  <span className="text-ink-600">
                    <span className="text-ink-400 mr-2">{i + 1}.</span>
                    {titleBySlug.get(slug) ?? slug}
                  </span>
                  <span className="font-mono text-ink-900 tabular-nums shrink-0">
                    {n}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card header="Top resources by avg time on page (seconds)">
          {topDwell.length === 0 ? (
            <p className="text-sm text-ink-500">
              No dwell data yet — views need unload beacons with timing.
            </p>
          ) : (
            <ol className="space-y-2 text-sm">
              {topDwell.slice(0, 15).map((row, i) => (
                <li
                  key={row.slug}
                  className="flex justify-between gap-4 border-b border-cream-100 pb-2 last:border-0"
                >
                  <span className="text-ink-600">
                    <span className="text-ink-400 mr-2">{i + 1}.</span>
                    {titleBySlug.get(row.slug) ?? row.slug}
                  </span>
                  <span className="font-mono text-ink-900 tabular-nums shrink-0">
                    {row.avg}s <span className="text-ink-400">({row.samples})</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card header="Dead content (no views in 30 days)">
          {deadSlugs.length === 0 ? (
            <p className="text-sm text-ink-500">
              Every catalog resource had at least one view in the last 30 days.
            </p>
          ) : (
            <ul className="space-y-2 text-sm text-ink-700">
              {deadSlugs.map((slug) => (
                <li key={slug}>
                  <Link
                    href={`/dashboard/resources/${slug}`}
                    className="text-accent-terracotta hover:underline"
                  >
                    {titleBySlug.get(slug) ?? slug}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
