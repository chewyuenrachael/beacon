import { SchoolCard } from "@/components/intelligence/SchoolCard";
import { getInstitutionMetrics } from "@/lib/institution-metrics";

const STRATEGIC = [
  { id: "mit", name: "MIT" },
  { id: "stanford", name: "Stanford" },
  { id: "cmu", name: "CMU" },
  { id: "berkeley", name: "Berkeley" },
  { id: "columbia", name: "Columbia" },
] as const;

export default async function DashboardPage() {
  const strategicLoaded = await Promise.all(
    STRATEGIC.map(async (s) => ({
      ...s,
      metrics: await getInstitutionMetrics(s.id),
    }))
  );

  const cornellMetrics = await getInstitutionMetrics("cornell");

  return (
    <div className="max-w-5xl mx-auto space-y-10 py-2">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-semibold text-text-primary">
          Campus intelligence
        </h1>
        <p className="text-sm text-text-secondary max-w-2xl">
          Day 1 view across five strategic CS programs. Select a campus for
          faculty coverage, ambassadors, events, and observation volume.
        </p>
      </header>

      <section aria-label="Strategic schools">
        <h2 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-3">
          Strategic schools
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {strategicLoaded.map((s) => (
            <SchoolCard
              key={s.id}
              institutionId={s.id}
              name={s.name}
              variant="primary"
              metrics={{
                professor_count: s.metrics.professor_count,
                ambassador_active_count: s.metrics.ambassador_active_count,
                upcoming_events_count: s.metrics.upcoming_events_count,
                total_observations_last_30d: s.metrics.total_observations_last_30d,
              }}
            />
          ))}
        </div>
      </section>

      <section aria-label="Reference slice" className="border-t border-border-subtle pt-8">
        <h2 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-3">
          Reference slice
        </h2>
        <div className="max-w-xs">
          <SchoolCard
            institutionId="cornell"
            name="Cornell"
            subtitle="Original demo target"
            variant="example"
            metrics={{
              professor_count: cornellMetrics.professor_count,
              ambassador_active_count: cornellMetrics.ambassador_active_count,
              upcoming_events_count: cornellMetrics.upcoming_events_count,
              total_observations_last_30d: cornellMetrics.total_observations_last_30d,
            }}
          />
        </div>
      </section>
    </div>
  );
}
