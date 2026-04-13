"use client";

import Link from "next/link";
import type { Incident } from "@/app/dashboard/warroom/types";
import { SEVERITY_CONFIG, STATUS_CONFIG, formatElapsed } from "@/app/dashboard/warroom/types";

interface IncidentCardProps {
  incident: Incident;
  now: number;
}

export default function IncidentCard({ incident, now }: IncidentCardProps) {
  const sev = SEVERITY_CONFIG[incident.severity];
  const status = STATUS_CONFIG[incident.status];

  const startTime = new Date(incident.first_detected_at || incident.created_at).getTime();
  const endTime = incident.resolved_at ? new Date(incident.resolved_at).getTime() : now;
  const elapsed = endTime - startTime;

  const stTotal = incident.stakeholder_progress?.total ?? 0;
  const stNotified = incident.stakeholder_progress?.notified ?? 0;
  const stakeholderPct = stTotal > 0 ? Math.round((stNotified / stTotal) * 100) : 0;

  return (
    <Link href={`/dashboard/warroom/${incident.id}`}>
      <div
        className={`bg-white border border-cream-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer border-l-4 ${sev.border}`}
      >
        <div className="p-4">
          {/* Top row: severity + time */}
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${sev.bg} ${sev.text} ${incident.severity === "critical" || incident.severity === "high" ? "animate-beacon" : ""}`}>
              {sev.emoji} {sev.label}
            </span>
            <span className="text-xs text-ink-400">
              ⏱️ {formatElapsed(elapsed)}
            </span>
          </div>

          {/* Title */}
          <h3 className="font-display text-sm font-medium text-ink-900 mb-1 leading-snug">
            {incident.title}
          </h3>

          {/* Meta row */}
          <div className="flex items-center gap-2 text-xs text-ink-400 mb-3">
            {incident.incident_type && (
              <span>{incident.incident_type}</span>
            )}
            {incident.mention_count > 0 && (
              <>
                <span>·</span>
                <span>{incident.mention_count} mention{incident.mention_count !== 1 ? "s" : ""}</span>
              </>
            )}
            {incident.velocity_status && incident.velocity_status !== "normal" && (
              <>
                <span>·</span>
                <span className={incident.velocity_status === "accelerating" ? "text-red-600" : ""}>
                  {incident.velocity_status}
                </span>
              </>
            )}
          </div>

          {/* Stakeholder progress */}
          {stTotal > 0 && (
            <div className="mb-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-ink-500">Stakeholders:</span>
                <div className="flex-1 bg-cream-200 rounded-full h-1.5">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${stakeholderPct}%` }}
                  />
                </div>
                <span className="text-xs text-ink-400">
                  {stNotified}/{stTotal} notified
                </span>
              </div>
            </div>
          )}

          {/* Draft status */}
          {incident.latest_draft_status && (
            <div className="flex items-center gap-1.5 text-xs text-ink-500">
              <span>✍️</span>
              <span className="capitalize">
                Draft ({incident.latest_draft_status})
              </span>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-cream-100">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${status.bg} ${status.text}`}>
              {status.label}
            </span>
            <span className="text-xs text-accent-terracotta font-medium">
              Open War Room &rarr;
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
