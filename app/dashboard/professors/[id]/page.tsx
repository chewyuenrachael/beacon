import { createServerComponentClient } from "@/lib/supabase";
import { listObservationsForProfessor } from "@/lib/observations";
import { MetricCard } from "@/components/ui/MetricCard.forge";
import { Card } from "@/components/ui/Card";
import { ReenrichButton } from "./ReenrichButton";
import type { Observation } from "@/lib/types";

export default async function ProfessorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerComponentClient();

  const { data: professor, error: pErr } = await supabase
    .from("professors")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (pErr || !professor) {
    return (
      <div className="text-sm text-text-secondary">
        Professor not found{pErr ? `: ${pErr.message}` : ""}.
      </div>
    );
  }

  const { data: institution } = await supabase
    .from("institutions")
    .select("name")
    .eq("id", professor.institution_id)
    .maybeSingle();

  const institutionName = institution?.name ?? "Unknown institution";

  const obsDesc = await listObservationsForProfessor(supabase, id, {
    limit: 20,
    ascending: false,
  });
  const timeline: Observation[] = [...obsDesc].reverse();

  const keywordObs = obsDesc.filter(
    (o) => o.observation_type === "paper_matches_keywords"
  );
  const topPapers = keywordObs.slice(0, 3).map((o) => ({
    title: String(o.payload.title ?? ""),
    abstract: String(o.payload.abstract ?? ""),
  }));

  const count = Number(professor.recent_relevant_papers_count ?? 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary font-display">
            {professor.name}
          </h1>
          <p className="text-sm text-text-secondary mt-1">{institutionName}</p>
        </div>
        <ReenrichButton professorId={id} />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          value={count}
          label="recent_relevant_papers_count (24 months)"
          mono
        />
      </div>

      <section>
        <h2 className="text-sm font-semibold text-text-primary mb-2">
          Top matching papers
        </h2>
        <div className="space-y-3">
          {topPapers.length === 0 ? (
            <p className="text-sm text-text-secondary">
              No keyword matches yet — use Re-enrich to run the pipeline.
            </p>
          ) : (
            topPapers.map((p, i) => (
              <Card key={i} className="p-4">
                <h3 className="text-sm font-medium text-text-primary">{p.title}</h3>
                <p className="mt-2 text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">
                  {p.abstract}
                </p>
              </Card>
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-text-primary mb-2">
          Observation timeline
        </h2>
        <ol className="space-y-2 border-l border-border-subtle pl-4">
          {timeline.map((o) => (
            <li key={o.id} className="text-xs text-text-secondary">
              <span className="font-mono text-text-primary">
                {o.observation_type}
              </span>
              <span className="mx-2 text-text-tertiary">·</span>
              <time dateTime={o.observed_at}>{o.observed_at}</time>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
