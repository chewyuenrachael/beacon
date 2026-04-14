import Link from "next/link";
import type { InstitutionMetrics } from "@/lib/types/intelligence";

export interface SchoolCardProps {
  institutionId: string;
  name: string;
  /** Shown under the school name */
  subtitle?: string;
  variant?: "primary" | "example";
  metrics: Pick<
    InstitutionMetrics,
    | "professor_count"
    | "ambassador_active_count"
    | "upcoming_events_count"
    | "total_observations_last_30d"
  >;
}

export function SchoolCard({
  institutionId,
  name,
  subtitle,
  variant = "primary",
  metrics,
}: SchoolCardProps) {
  const isExample = variant === "example";

  const shell = isExample
    ? "max-w-sm rounded-md border border-border-subtle/60 bg-surface/80 p-3 text-left shadow-none opacity-95"
    : "rounded-md border border-border-subtle bg-surface p-4 text-left shadow-sm hover:border-border-strong transition-colors";

  return (
    <Link href={`/dashboard/institutions/${institutionId}`} className="block group">
      <article className={shell}>
        <h2
          className={`font-display font-semibold text-text-primary ${
            isExample ? "text-base" : "text-lg"
          } group-hover:text-accent-terracotta transition-colors`}
        >
          {name}
        </h2>
        {subtitle ? (
          <p
            className={`mt-0.5 text-text-tertiary ${
              isExample ? "text-[11px]" : "text-xs"
            }`}
          >
            {subtitle}
          </p>
        ) : null}
        <dl
          className={`mt-3 grid grid-cols-2 gap-x-3 gap-y-2 ${
            isExample ? "text-[11px]" : "text-xs"
          } text-text-secondary`}
        >
          <div>
            <dt className="text-text-tertiary">Faculty</dt>
            <dd className="font-mono tabular-nums">{metrics.professor_count}</dd>
          </div>
          <div>
            <dt className="text-text-tertiary">Active ambassadors</dt>
            <dd className="font-mono tabular-nums">
              {metrics.ambassador_active_count}
            </dd>
          </div>
          <div>
            <dt className="text-text-tertiary">Upcoming events</dt>
            <dd className="font-mono tabular-nums">
              {metrics.upcoming_events_count}
            </dd>
          </div>
          <div>
            <dt className="text-text-tertiary">Observations (30d)</dt>
            <dd className="font-mono tabular-nums">
              {metrics.total_observations_last_30d}
            </dd>
          </div>
        </dl>
      </article>
    </Link>
  );
}
