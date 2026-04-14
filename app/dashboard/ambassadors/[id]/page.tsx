import Link from "next/link";
import { AmbassadorScoreCard } from "@/components/ambassadors/AmbassadorScoreCard";
import { StageBadge } from "@/components/ambassadors/StageBadge";
import { Card } from "@/components/ui/Card";
import { MetricCard } from "@/components/ui/MetricCard.forge";
import {
  allowedNextStages,
  listObservationsForAmbassador,
  mapAmbassadorRow,
} from "@/lib/ambassador-pipeline";
import { createServerComponentClient } from "@/lib/supabase-server";
import type { AmbassadorStage, Observation } from "@/lib/types";
import { AdvanceStageButton } from "./AdvanceStageButton";
import { HealthRefreshButton } from "./HealthRefreshButton";
import { RescoreButton } from "./RescoreButton";

export default async function AmbassadorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerComponentClient();

  const { data: row, error: rowErr } = await supabase
    .from("ambassadors")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (rowErr || !row) {
    return (
      <div className="text-sm text-text-secondary">
        Ambassador not found{rowErr ? `: ${rowErr.message}` : ""}.
      </div>
    );
  }

  const ambassador = mapAmbassadorRow(row as Record<string, unknown>);

  const { data: institution } = await supabase
    .from("institutions")
    .select("name")
    .eq("id", ambassador.institution_id)
    .maybeSingle();

  const institutionName =
    (institution?.name as string | undefined) ?? ambassador.institution_id;

  const obsDesc = await listObservationsForAmbassador(supabase, id, {
    limit: 50,
    ascending: false,
  });
  const timeline: Observation[] = [...obsDesc].reverse();

  const nextStages = allowedNextStages(ambassador.stage);

  const appJson = JSON.stringify(ambassador.application_data, null, 2);

  return (
    <div className="space-y-8 max-w-4xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/ambassadors"
            className="text-xs text-text-tertiary hover:text-text-primary mb-2 inline-block"
          >
            ← Ambassadors
          </Link>
          <h1 className="text-2xl font-semibold text-text-primary font-display">
            {ambassador.name}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {institutionName} · {ambassador.email}
          </p>
          <div className="mt-2">
            <StageBadge stage={ambassador.stage as AmbassadorStage} />
          </div>
        </div>
      </header>

      <section>
        <h2 className="text-sm font-semibold text-text-primary mb-3">
          Score breakdown
        </h2>
        <AmbassadorScoreCard score={ambassador.score} />
        <div className="mt-3">
          <RescoreButton ambassadorId={id} />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-xs uppercase tracking-wider text-text-tertiary font-medium mb-3">
            Health (0–100)
          </h2>
          <HealthRefreshButton
            ambassadorId={id}
            initialHealth={ambassador.health_score}
          />
        </Card>
        <div className="grid grid-cols-1 gap-3">
          {ambassador.accepted_at && (
            <MetricCard
              value={new Date(ambassador.accepted_at).toLocaleDateString()}
              label="Accepted at"
            />
          )}
          {ambassador.last_active_at && (
            <MetricCard
              value={new Date(ambassador.last_active_at).toLocaleDateString()}
              label="Last active"
            />
          )}
        </div>
      </section>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-3">
          Advance stage
        </h2>
        <AdvanceStageButton
          key={ambassador.stage}
          ambassadorId={id}
          options={nextStages}
        />
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-2">
          Application data
        </h2>
        <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono bg-[#F5F2EC] p-3 rounded-md overflow-x-auto">
          {appJson}
        </pre>
        {ambassador.github_username && (
          <p className="text-sm text-text-secondary mt-2">
            GitHub:{" "}
            <span className="font-mono text-text-primary">
              {ambassador.github_username}
            </span>
          </p>
        )}
      </Card>

      <section>
        <h2 className="text-sm font-semibold text-text-primary mb-2">
          Observation timeline
        </h2>
        <p className="text-xs text-text-tertiary mb-3">
          Append-only log for entity_type <code className="font-mono">ambassador</code>
        </p>
        <ol className="space-y-2 border-l border-border-subtle pl-4">
          {timeline.length === 0 ? (
            <li className="text-sm text-text-secondary">No observations yet.</li>
          ) : (
            timeline.map((o) => (
              <li key={o.id} className="text-xs text-text-secondary">
                <span className="font-mono text-text-primary">
                  {o.observation_type}
                </span>
                <span className="mx-2 text-text-tertiary">·</span>
                <time dateTime={o.observed_at}>{o.observed_at}</time>
              </li>
            ))
          )}
        </ol>
      </section>
    </div>
  );
}
