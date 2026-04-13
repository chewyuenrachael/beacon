import type { FC } from "react";
import Link from "next/link";
import { StageBadge } from "@/components/ambassadors/StageBadge";
import type { Ambassador, AmbassadorStage } from "@/lib/types";

export interface AmbassadorTableRow {
  ambassador: Ambassador;
  institutionName: string;
}

interface AmbassadorTableProps {
  rows: AmbassadorTableRow[];
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

export const AmbassadorTable: FC<AmbassadorTableProps> = ({ rows }) => {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-text-secondary py-8">
        No ambassadors match the current filters.
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
              Stage
            </th>
            <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">
              Score
            </th>
            <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">
              Institution
            </th>
            <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">
              Last active
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ ambassador: a, institutionName }) => (
            <tr
              key={a.id}
              className="border-b border-border-subtle hover:bg-[#FAF8F4] transition-colors"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/dashboard/ambassadors/${a.id}`}
                  className="font-medium text-text-primary hover:text-[#C45A3C] underline-offset-2 hover:underline"
                >
                  {a.name}
                </Link>
                <div className="text-xs text-text-tertiary mt-0.5">{a.email}</div>
              </td>
              <td className="px-4 py-3">
                <StageBadge stage={a.stage as AmbassadorStage} />
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">
                {a.score?.total ?? "—"}
              </td>
              <td className="px-4 py-3 text-text-secondary">{institutionName}</td>
              <td className="px-4 py-3 text-text-secondary tabular-nums">
                {formatDate(a.last_active_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
