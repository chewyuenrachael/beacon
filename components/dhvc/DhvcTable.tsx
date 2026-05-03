import type { FC } from "react";
import Link from "next/link";

import { DhvcSourceBadge } from "@/components/dhvc/DhvcSourceBadge";
import type { DhvcCandidate } from "@/lib/types";

export interface DhvcTableRow {
  candidate: DhvcCandidate;
  institutionName: string;
}

interface DhvcTableProps {
  rows: DhvcTableRow[];
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export const DhvcTable: FC<DhvcTableProps> = ({ rows }) => {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-text-secondary py-8">
        No DHVC candidates match the current filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border border-[#D0CCC4] rounded-md bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-default bg-[#F5F2EC]">
            <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">
              Name
            </th>
            <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">
              Institution
            </th>
            <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">
              Source
            </th>
            <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">
              Score
            </th>
            <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">
              Grad year
            </th>
            <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">
              Last enriched
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ candidate: c, institutionName }) => {
            const total = c.score?.total ?? null;
            const breakdown = c.score
              ? `tech ${c.score.technical_output} · reach ${c.score.public_reach} · fit ${c.score.school_fit} · cursor ${c.score.cursor_signal}`
              : "no score yet";
            return (
              <tr
                key={c.id}
                className="border-b border-border-subtle hover:bg-[#FAF8F4] transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/dhvc/${c.id}`}
                    className="font-medium text-text-primary hover:text-[#C45A3C] underline-offset-2 hover:underline"
                  >
                    {c.name}
                  </Link>
                  <div className="text-xs text-text-tertiary mt-0.5">
                    {[c.email, c.github_username && `gh:${c.github_username}`]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {institutionName}
                </td>
                <td className="px-4 py-3">
                  <DhvcSourceBadge source={c.primary_source} />
                </td>
                <td
                  className="px-4 py-3 text-right font-mono tabular-nums"
                  title={breakdown}
                >
                  {total ?? "—"}
                </td>
                <td className="px-4 py-3 text-right text-text-secondary tabular-nums">
                  {c.graduation_year ?? "—"}
                </td>
                <td className="px-4 py-3 text-text-secondary tabular-nums">
                  {formatDate(c.last_enriched_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
