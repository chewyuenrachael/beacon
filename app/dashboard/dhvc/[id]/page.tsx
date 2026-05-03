import Link from "next/link";

import { AcceptCandidateButton } from "@/components/dhvc/AcceptCandidateButton";
import { DhvcScoreCard } from "@/components/dhvc/DhvcScoreCard";
import { DhvcSourceBadge } from "@/components/dhvc/DhvcSourceBadge";
import { EditableNotesField } from "@/components/dhvc/EditableNotesField";
import { RejectCandidateButton } from "@/components/dhvc/RejectCandidateButton";
import { Card } from "@/components/ui/Card";
import { mapDhvcCandidateRow } from "@/lib/dhvc-orchestrator";
import { createServerComponentClient } from "@/lib/supabase-server";
import type { Observation } from "@/lib/types";

function reviewStageLabel(stage: string): string {
  return stage.replace(/_/g, " ");
}

const TERMINAL_STAGES = new Set(["accepted", "rejected", "archived"]);

export default async function DhvcCandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerComponentClient();

  const { data: row, error: rowErr } = await supabase
    .from("dhvc_candidates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (rowErr || !row) {
    return (
      <div className="text-sm text-text-secondary">
        DHVC candidate not found{rowErr ? `: ${rowErr.message}` : ""}.
      </div>
    );
  }

  const candidate = mapDhvcCandidateRow(row as Record<string, unknown>);

  const { data: institution } = await supabase
    .from("institutions")
    .select("name")
    .eq("id", candidate.institution_id)
    .maybeSingle();

  const institutionName =
    (institution?.name as string | undefined) ?? candidate.institution_id;

  const { data: obsRows } = await supabase
    .from("observations")
    .select("*")
    .eq("entity_type", "dhvc_candidate")
    .eq("entity_id", id)
    .order("observed_at", { ascending: false })
    .limit(50);

  const timeline: Observation[] = (obsRows ?? []).map((r) => {
    const o = r as Record<string, unknown>;
    return {
      id: o.id as string,
      entity_type: "dhvc_candidate",
      entity_id: o.entity_id as string,
      observation_type: o.observation_type as Observation["observation_type"],
      payload: (o.payload as Record<string, unknown>) ?? {},
      source: o.source as Observation["source"],
      source_url: (o.source_url as string | null) ?? undefined,
      confidence: Number(o.confidence ?? 0),
      observed_at: o.observed_at as string,
      created_at: o.created_at as string,
    };
  });

  const ascendingTimeline = [...timeline].reverse();
  const isTerminal = TERMINAL_STAGES.has(candidate.review_stage);

  return (
    <div className="space-y-8 max-w-4xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/dhvc"
            className="text-xs text-text-tertiary hover:text-text-primary mb-2 inline-block"
          >
            ← DHVC candidates
          </Link>
          <h1 className="text-2xl font-semibold text-text-primary font-display">
            {candidate.name}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {institutionName}
            {candidate.email && ` · ${candidate.email}`}
            {candidate.github_username &&
              ` · gh:${candidate.github_username}`}
            {candidate.twitter_handle && ` · tw:${candidate.twitter_handle}`}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <DhvcSourceBadge source={candidate.primary_source} />
            <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium font-mono bg-[#E8E4D9] text-text-primary">
              {reviewStageLabel(candidate.review_stage)}
            </span>
          </div>
        </div>
      </header>

      <section>
        <h2 className="text-sm font-semibold text-text-primary mb-3">
          Score breakdown
        </h2>
        <DhvcScoreCard score={candidate.score} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            Decision
          </h2>
          {isTerminal ? (
            <div className="space-y-2">
              <p className="text-sm text-text-secondary">
                Already in <code className="font-mono">{candidate.review_stage}</code>.
              </p>
              {candidate.reviewed_at && (
                <p className="text-xs text-text-tertiary">
                  Reviewed at {new Date(candidate.reviewed_at).toLocaleString()}
                  {candidate.reviewed_by && ` · by ${candidate.reviewed_by}`}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <AcceptCandidateButton candidateId={candidate.id} />
              <RejectCandidateButton candidateId={candidate.id} />
            </div>
          )}
        </Card>
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            Discovery
          </h2>
          <dl className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <dt className="text-text-tertiary uppercase tracking-wider">
                Discovered at
              </dt>
              <dd className="font-mono text-text-primary tabular-nums">
                {new Date(candidate.discovered_at).toLocaleDateString()}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-text-tertiary uppercase tracking-wider">
                Last enriched
              </dt>
              <dd className="font-mono text-text-primary tabular-nums">
                {candidate.last_enriched_at
                  ? new Date(candidate.last_enriched_at).toLocaleDateString()
                  : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-text-tertiary uppercase tracking-wider">
                Major
              </dt>
              <dd className="text-text-primary">{candidate.major ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-text-tertiary uppercase tracking-wider">
                Graduation
              </dt>
              <dd className="font-mono text-text-primary tabular-nums">
                {candidate.graduation_year ?? "—"}
              </dd>
            </div>
          </dl>
        </Card>
      </section>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-3">
          Source URLs ({candidate.source_urls.length})
        </h2>
        {candidate.source_urls.length === 0 ? (
          <p className="text-sm text-text-secondary">No source URLs recorded.</p>
        ) : (
          <ul className="space-y-2">
            {candidate.source_urls.map((u) => (
              <li
                key={u.url}
                className="flex flex-col gap-0.5 border-l-2 border-border-subtle pl-3"
              >
                <div className="flex items-center gap-2">
                  <DhvcSourceBadge source={u.source} />
                  <a
                    href={u.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-text-primary hover:text-[#C45A3C] underline-offset-2 hover:underline truncate"
                  >
                    {u.url}
                  </a>
                </div>
                <p className="text-xs text-text-secondary">{u.description}</p>
                <p className="text-xs text-text-tertiary font-mono">
                  observed {new Date(u.observed_at).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-3">
          Editable fields
        </h2>
        <EditableNotesField
          candidateId={candidate.id}
          initialNotes={candidate.notes ?? ""}
          initialEmail={candidate.email ?? ""}
          initialMajor={candidate.major ?? ""}
          initialGraduationYear={candidate.graduation_year}
        />
      </Card>

      <section>
        <h2 className="text-sm font-semibold text-text-primary mb-2">
          Observation timeline
        </h2>
        <p className="text-xs text-text-tertiary mb-3">
          Append-only log for entity_type{" "}
          <code className="font-mono">dhvc_candidate</code>
        </p>
        <ol className="space-y-2 border-l border-border-subtle pl-4">
          {ascendingTimeline.length === 0 ? (
            <li className="text-sm text-text-secondary">
              No observations yet.
            </li>
          ) : (
            ascendingTimeline.map((o) => (
              <li key={o.id} className="text-xs text-text-secondary">
                <span className="font-mono text-text-primary">
                  {o.observation_type}
                </span>
                <span className="mx-2 text-text-tertiary">·</span>
                <span className="font-mono text-text-tertiary">{o.source}</span>
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
