import Link from "next/link";
import { createServerComponentClient } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";

function buildProfessorsHref(params: {
  institution_id?: string;
  sort?: string;
}): string {
  const q = new URLSearchParams();
  if (params.institution_id) q.set("institution_id", params.institution_id);
  if (params.sort) q.set("sort", params.sort);
  const s = q.toString();
  return s ? `/dashboard/professors?${s}` : "/dashboard/professors";
}

export default async function ProfessorsDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    institution_id?: string;
    sort?: string;
  }>;
}) {
  const sp = await searchParams;
  const institutionFilter = sp.institution_id?.trim() || "";
  const papersAsc = sp.sort === "papers_asc";

  const supabase = await createServerComponentClient();

  const { data: institutions, error: instErr } = await supabase
    .from("institutions")
    .select("id,name")
    .order("name", { ascending: true });

  if (instErr) throw instErr;

  let q = supabase
    .from("professors")
    .select(
      "id,name,institution_id,recent_relevant_papers_count,last_enriched_at"
    );

  if (institutionFilter) {
    q = q.eq("institution_id", institutionFilter);
  }

  q = papersAsc
    ? q.order("recent_relevant_papers_count", { ascending: true })
    : q.order("recent_relevant_papers_count", { ascending: false });
  q = q.order("name", { ascending: true });

  const { data: rows, error } = await q;
  if (error) throw error;

  const instName = new Map(
    (institutions ?? []).map((i) => [i.id as string, i.name as string])
  );

  const sortOther = papersAsc ? undefined : "papers_asc";
  const sortLabel = papersAsc ? "Papers: low → high" : "Papers: high → low";

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2">
      <header className="space-y-1">
        <p className="text-xs text-text-tertiary uppercase tracking-wide">
          <Link href="/dashboard" className="hover:text-text-secondary">
            Campus intelligence
          </Link>
        </p>
        <h1 className="font-display text-2xl font-semibold text-text-primary">
          Professors
        </h1>
        <p className="text-sm text-text-secondary">
          Eval fixture faculty plus any additional seeded rows. Filter by campus
          and sort by recent relevant papers (24‑month keyword window).
        </p>
      </header>

      <Card header="Institution">
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href={buildProfessorsHref({
              sort: papersAsc ? "papers_asc" : undefined,
            })}
            className={`rounded-full border px-3 py-1 ${
              !institutionFilter
                ? "border-accent-terracotta text-accent-terracotta"
                : "border-border-subtle text-text-secondary hover:border-border-strong"
            }`}
          >
            All
          </Link>
          {(institutions ?? []).map((i) => {
            const id = i.id as string;
            const active = institutionFilter === id;
            return (
              <Link
                key={id}
                href={buildProfessorsHref({
                  institution_id: id,
                  sort: papersAsc ? "papers_asc" : undefined,
                })}
                className={`rounded-full border px-3 py-1 ${
                  active
                    ? "border-accent-terracotta text-accent-terracotta"
                    : "border-border-subtle text-text-secondary hover:border-border-strong"
                }`}
              >
                {i.name as string}
              </Link>
            );
          })}
        </div>
      </Card>

      <Card
        header={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Directory</span>
            <Link
              href={buildProfessorsHref({
                institution_id: institutionFilter || undefined,
                sort: sortOther,
              })}
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
                <th className="pb-2 pr-4 font-medium">Institution</th>
                <th className="pb-2 pr-4 font-medium">Recent relevant papers</th>
                <th className="pb-2 font-medium">Last enriched</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((row) => {
                const iid = row.institution_id as string;
                return (
                  <tr
                    key={row.id as string}
                    className="border-b border-border-subtle/60 last:border-0"
                  >
                    <td className="py-2 pr-4">
                      <Link
                        href={`/dashboard/professors/${row.id as string}`}
                        className="text-text-primary hover:text-accent-terracotta font-medium"
                      >
                        {row.name as string}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-text-secondary">
                      <Link
                        href={`/dashboard/institutions/${iid}`}
                        className="hover:text-accent-terracotta"
                      >
                        {instName.get(iid) ?? iid}
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
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
