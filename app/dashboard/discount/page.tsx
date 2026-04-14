import Link from "next/link";
import { startOfWeek } from "date-fns";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { MetricCard } from "@/components/ui/MetricCard";
import { Card } from "@/components/ui/Card";
import type { Observation } from "@/lib/types";

function isThisWeek(iso: string, weekStart: Date): boolean {
  try {
    return new Date(iso) >= weekStart;
  } catch {
    return false;
  }
}

function isFailureAttempt(row: {
  sheerid_response_code: string;
  status: string;
}): boolean {
  return (
    row.sheerid_response_code !== "success" || row.status === "rejected"
  );
}

function formatActivityLine(o: Observation): string {
  const p = o.payload as Record<string, unknown>;
  switch (o.observation_type) {
    case "verification_attempted":
      return `${p.email ?? "?"} — attempted (${String(p.sheerid_response_code ?? "")})`;
    case "cursor_user_institution_mapped":
      return `${p.email ?? "?"} — institution mapped → ${String(p.institution_id ?? "")}`;
    case "action_completed": {
      const kind = String(p.kind ?? "");
      if (kind === "verification_approved") {
        return `${p.email ?? "?"} — approved (${String(p.institution_id ?? "")})`;
      }
      if (kind === "verification_rejected") {
        return `${p.email ?? "?"} — rejected: ${String(p.reason ?? "").slice(0, 80)}`;
      }
      return `action_completed: ${kind || "—"}`;
    }
    default:
      return o.observation_type;
  }
}

export default async function DiscountOverviewPage() {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  const { data: attempts, error: aErr } = await supabaseAdmin
    .from("verification_attempts")
    .select("*");

  if (aErr) {
    return (
      <div className="text-sm text-red-700">
        Failed to load verifications: {aErr.message}
      </div>
    );
  }

  const rows = attempts ?? [];
  const thisWeek = rows.filter((r) =>
    isThisWeek(r.created_at as string, weekStart)
  );

  const totalWeek = thisWeek.length;
  const approvedWeek = thisWeek.filter((r) => r.status === "approved").length;
  const successRate =
    totalWeek === 0
      ? "—"
      : `${Math.round((approvedWeek / totalWeek) * 100)}%`;

  const queueDepth = rows.filter(
    (r) => r.status === "pending" || r.status === "manual_review"
  ).length;

  const failureByCountry = new Map<string, number>();
  for (const r of rows) {
    if (!isFailureAttempt(r as { sheerid_response_code: string; status: string }))
      continue;
    const label = (r.country as string)?.trim() || "Unknown";
    failureByCountry.set(label, (failureByCountry.get(label) ?? 0) + 1);
  }
  let topFailing = "—";
  let topCount = 0;
  for (const [country, n] of failureByCountry) {
    if (n > topCount) {
      topCount = n;
      topFailing = country;
    }
  }
  if (topCount === 0) topFailing = "—";

  const { data: obsRows, error: oErr } = await supabaseAdmin
    .from("observations")
    .select("*")
    .in("observation_type", [
      "verification_attempted",
      "cursor_user_institution_mapped",
      "action_completed",
    ])
    .order("observed_at", { ascending: false })
    .limit(60);

  const activity: Observation[] = [];
  if (!oErr && obsRows) {
    for (const raw of obsRows) {
      const o = raw as unknown as Observation;
      if (o.observation_type === "action_completed") {
        const kind = String((o.payload as Record<string, unknown>).kind ?? "");
        if (
          kind !== "verification_approved" &&
          kind !== "verification_rejected"
        ) {
          continue;
        }
      }
      activity.push(o);
      if (activity.length >= 15) break;
    }
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="font-display text-xl font-semibold text-text-primary">
          Discount provisioning
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          SheerID verification queue and geography gaps (mock verifier in
          demo; production uses live SheerID).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          value={totalWeek}
          label="Verifications this week"
          mono
        />
        <MetricCard value={successRate} label="Success rate (this week)" />
        <MetricCard
          value={queueDepth}
          label="Queue depth (pending + manual review)"
          mono
        />
        <MetricCard value={topFailing} label="Top failing country" />
      </div>

      <div className="flex flex-wrap gap-4">
        <Link
          href="/dashboard/discount/queue"
          className="inline-flex items-center rounded-md border border-[#D0CCC4] bg-white px-4 py-2 text-sm font-medium text-text-primary hover:bg-[#F5F2EC]"
        >
          Open verification queue
        </Link>
        <Link
          href="/dashboard/discount/geography"
          className="inline-flex items-center rounded-md border border-[#C45A3C] bg-[#C45A3C]/10 px-4 py-2 text-sm font-medium text-[#8A3D2B] hover:bg-[#C45A3C]/20"
        >
          Geography report
        </Link>
      </div>

      <Card header="Recent activity">
        {oErr ? (
          <p className="text-sm text-red-700">
            Could not load observations: {oErr.message}
          </p>
        ) : activity.length === 0 ? (
          <p className="text-sm text-text-tertiary">
            No discount-related observations yet. Run{" "}
            <code className="text-xs bg-[#F0EDE6] px-1 rounded">pnpm seed</code>{" "}
            or POST to{" "}
            <code className="text-xs bg-[#F0EDE6] px-1 rounded">
              /api/verification
            </code>
            .
          </p>
        ) : (
          <ul className="space-y-2 text-sm text-text-primary">
            {activity.map((o) => (
              <li
                key={o.id}
                className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 border-b border-border-subtle pb-2 last:border-0"
              >
                <time
                  className="text-xs text-text-tertiary font-mono shrink-0 w-44"
                  dateTime={o.observed_at}
                >
                  {o.observed_at?.replace("T", " ").slice(0, 19) ?? ""}
                </time>
                <span className="text-text-secondary font-mono text-xs w-40 shrink-0">
                  {o.observation_type}
                </span>
                <span>{formatActivityLine(o)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
