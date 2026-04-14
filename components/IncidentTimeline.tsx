"use client";

import { formatDistanceToNow } from "date-fns";
import type { TimelineEntry } from "@/lib/warroom-ui";
import { TIMELINE_ICONS } from "@/lib/warroom-ui";

interface IncidentTimelineProps {
  timeline: TimelineEntry[];
  isActive: boolean;
}

function entryLabel(entry: TimelineEntry): string {
  const d = entry.data || {};
  switch (entry.type) {
    case "fire_detected":
    case "mention":
      return `Fire detected — ${d.title || "New mention"}${d.source ? ` · ${d.source}` : ""}${d.engagement_score ? ` · ${d.engagement_score} pts` : ""}`;
    case "draft_created":
      return `Draft created — "${d.title || "Untitled"}"${d.template ? ` · from template "${d.template}"` : ""}`;
    case "draft_approved":
      return `Draft approved${d.approved_by ? ` by ${d.approved_by}` : ""}${d.title ? ` · "${d.title}"` : ""}`;
    case "stakeholder_notified":
      return `Stakeholder notified — ${d.name || "Unknown"}${d.role ? ` (${d.role})` : ""}${d.channel ? ` via ${d.channel}` : ""}`;
    case "comment_added":
      return `Comment${d.author ? ` by ${d.author}` : ""}${d.role ? ` (${d.role})` : ""}: "${typeof d.body === "string" ? d.body.slice(0, 80) : "..."}"`;
    case "mention_linked":
      return `New mention linked — "${d.title || "Untitled"}"${d.source ? ` · ${d.source}` : ""}${d.engagement_score ? ` · ${d.engagement_score} pts` : ""}`;
    case "incident_resolved":
      return `Incident resolved${d.response_time ? ` · Response time: ${d.response_time}` : ""}`;
    case "status_changed":
      return `Status changed${d.from ? ` from ${d.from}` : ""} to ${d.to || "unknown"}`;
    case "severity_changed":
      return `Severity changed${d.from ? ` from ${d.from}` : ""} to ${d.to || "unknown"}`;
    default:
      return entry.type;
  }
}

export default function IncidentTimeline({ timeline }: IncidentTimelineProps) {
  if (timeline.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-ink-300">No timeline events yet.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-cream-200" />

      <div className="space-y-4">
        {timeline.map((entry) => {
          const icon = TIMELINE_ICONS[entry.type] || { emoji: "•", color: "bg-gray-400" };
          return (
            <div key={entry.id} className="relative flex gap-3 pl-0">
              {/* Dot */}
              <div className="relative z-10 flex-shrink-0 w-6 h-6 flex items-center justify-center">
                <span className="text-xs leading-none">{icon.emoji}</span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-1">
                <p className="text-xs text-ink-300 mb-0.5">
                  {formatDistanceToNow(new Date(entry.time), { addSuffix: true })}
                </p>
                <p className="text-sm text-ink-700 leading-snug">
                  {entryLabel(entry)}
                </p>
                {typeof entry.data?.source_url === "string" && (
                  <a
                    href={entry.data.source_url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent-terracotta hover:underline mt-0.5 inline-block"
                  >
                    View source &rarr;
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
