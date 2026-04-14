import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  countryLabelToIso3,
  FORUM_GAP_ISO3,
} from "@/lib/discount-country";
import { GeographyMap } from "@/components/discount/GeographyMap";
import { Card } from "@/components/ui/Card";

function isFailureAttempt(row: {
  sheerid_response_code: string;
  status: string;
}): boolean {
  return (
    row.sheerid_response_code !== "success" || row.status === "rejected"
  );
}

export default async function DiscountGeographyPage() {
  const { data: attempts, error } = await supabaseAdmin
    .from("verification_attempts")
    .select("*");

  if (error) {
    return (
      <div className="text-sm text-red-700">
        Failed to load verifications: {error.message}
      </div>
    );
  }

  const rows = attempts ?? [];
  const failureByLabel = new Map<string, number>();
  const countsByIso: Record<string, number> = {};

  for (const r of rows) {
    if (!isFailureAttempt(r as { sheerid_response_code: string; status: string }))
      continue;
    const label = (r.country as string)?.trim() || "Unknown";
    failureByLabel.set(label, (failureByLabel.get(label) ?? 0) + 1);
    const iso = countryLabelToIso3(label === "Unknown" ? null : label);
    if (iso) {
      countsByIso[iso] = (countsByIso[iso] ?? 0) + 1;
    }
  }

  const ranked = [...failureByLabel.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const indiaCount =
    failureByLabel.get("India") ??
    failureByLabel.get("india") ??
    countsByIso.IND ??
    0;
  const romaniaCount =
    failureByLabel.get("Romania") ??
    failureByLabel.get("romania") ??
    countsByIso.ROU ??
    0;

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex flex-wrap items-start gap-4 justify-between">
        <div>
          <Link
            href="/dashboard/discount"
            className="text-xs text-text-tertiary hover:text-text-primary mb-1 inline-block"
          >
            ← Discount overview
          </Link>
          <h1 className="font-display text-xl font-semibold text-text-primary">
            Geography — verification failures
          </h1>
          <p className="text-sm text-text-secondary mt-1 max-w-2xl">
            Failures include any attempt where SheerID did not return{" "}
            <code className="text-xs bg-[#F0EDE6] px-1 rounded">success</code>{" "}
            or the row was rejected. This is the operational view behind
            recurring Cursor forum threads: students in{" "}
            <strong>India</strong> and <strong>Romania</strong> (and similar
            unsupported regions) stall in automation.
          </p>
        </div>
        <Link
          href="/dashboard/discount/queue"
          className="text-sm text-[#C45A3C] hover:underline shrink-0"
        >
          Queue →
        </Link>
      </div>

      {(indiaCount > 0 || romaniaCount > 0) && (
        <div className="rounded-md border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Unsolved forum-scale gaps</p>
          <p className="mt-1 text-amber-900/90">
            {indiaCount > 0 && (
              <>India: <strong>{indiaCount}</strong> failure{indiaCount !== 1 ? "s" : ""}</>
            )}
            {indiaCount > 0 && romaniaCount > 0 && " · "}
            {romaniaCount > 0 && (
              <>Romania: <strong>{romaniaCount}</strong> failure{romaniaCount !== 1 ? "s" : ""}</>
            )}
            {" — "}these regions return{" "}
            <code className="text-xs bg-amber-100/60 px-1 rounded">country_unsupported</code>{" "}
            from SheerID and require manual review.
          </p>
        </div>
      )}

      <Card header="Failure density (ISO-3)">
        <GeographyMap countsByIso={countsByIso} />
      </Card>

      <Card header="Countries ranked by failure count">
        {ranked.length === 0 ? (
          <p className="text-sm text-text-tertiary">
            No failure rows yet. Run seed or create attempts via the API.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-text-tertiary font-medium">
                    Country
                  </th>
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wider text-text-tertiary font-medium">
                    Failures
                  </th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-text-tertiary font-medium">
                    Map ISO
                  </th>
                </tr>
              </thead>
              <tbody>
                {ranked.map(({ name, count }) => {
                  const iso = countryLabelToIso3(name);
                  const isGap =
                    iso &&
                    (FORUM_GAP_ISO3 as readonly string[]).includes(iso);
                  return (
                    <tr
                      key={name}
                      className={`border-b border-border-subtle ${
                        isGap ? "bg-orange-50/60" : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-sm text-text-primary">
                        {name}
                        {isGap && (
                          <span className="ml-2 text-xs font-medium text-orange-800">
                            (forum focus)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-right font-mono">
                        {count}
                      </td>
                      <td className="px-3 py-2 text-sm font-mono text-text-secondary">
                        {iso ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
