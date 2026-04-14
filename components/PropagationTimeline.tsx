"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

// ── Local types (cannot modify lib/types.ts) ──────────────────

interface PropagationMention {
  id: string;
  source: string;
  title: string | null;
  summary: string | null;
  urgency: string | null;
  engagement_score: number;
  published_at: string;
  source_url: string;
}

interface PlatformNode {
  platform: string;
  first_seen: string;
  mention_count: number;
  total_engagement: number;
}

export interface PropagationCluster {
  id: string;
  cluster_title: string;
  status: "active" | "slowing" | "resolved";
  platforms_reached: string[];
  platform_timeline: PlatformNode[];
  mentions: PropagationMention[];
  mention_ids: string[];
  has_fire: boolean;
  total_engagement: number;
  created_at: string;
}

interface PropagationTimelineProps {
  cluster: PropagationCluster;
  onClose: () => void;
}

// ── Constants ─────────────────────────────────────────────────

const PLATFORM_META: Record<string, { icon: string; color: string; label: string }> = {
  hackernews: { icon: "\u{1F536}", color: "#FF6600", label: "Hacker News" },
  reddit: { icon: "\u{1F534}", color: "#FF4500", label: "Reddit" },
  twitter: { icon: "\uD835\uDD4F", color: "#000000", label: "Twitter/X" },
  discord: { icon: "\u{1F4AC}", color: "#5865F2", label: "Discord" },
  youtube: { icon: "\u25B6\uFE0F", color: "#FF0000", label: "YouTube" },
  rss: { icon: "\uD83D\uDCF0", color: "#EE802F", label: "RSS/Press" },
};

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  active: { label: "Active", dot: "bg-red-500", bg: "bg-red-50", text: "text-red-700" },
  slowing: { label: "Slowing", dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700" },
  resolved: { label: "Resolved", dot: "bg-gray-400", bg: "bg-cream-100", text: "text-ink-500" },
};

const URGENCY_PILL: Record<string, string> = {
  fire: "bg-red-50 text-red-700 border border-red-200",
  moment: "bg-amber-50 text-amber-700 border border-amber-200",
  signal: "bg-blue-50 text-blue-700 border border-blue-200",
  noise: "bg-cream-100 text-ink-500 border border-cream-200",
};

// ── Component ─────────────────────────────────────────────────

export default function PropagationTimeline({ cluster, onClose }: PropagationTimelineProps) {
  const status = STATUS_CONFIG[cluster.status] || STATUS_CONFIG.resolved;
  const sortedTimeline = [...(cluster.platform_timeline || [])].sort(
    (a, b) => new Date(a.first_seen).getTime() - new Date(b.first_seen).getTime()
  );
  const firstPlatform = sortedTimeline[0];

  return (
    <div
      className="fixed inset-0 bg-black/20 z-50 flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-cream-50 h-full overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-cream-50 border-b border-cream-200 px-5 py-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span>{"\uD83C\uDF0A"}</span>
              <h2 className="font-display text-base font-semibold text-ink-900">
                {cluster.cluster_title}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${status.bg} ${status.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
              <span className="text-[10px] text-ink-300">
                {cluster.platforms_reached.length} platforms
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-300 hover:text-ink-600 transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Summary */}
          <div className="text-xs text-ink-500 space-y-0.5">
            {firstPlatform && (
              <p>
                First detected on{" "}
                <span className="font-medium text-ink-700">
                  {PLATFORM_META[firstPlatform.platform]?.label || firstPlatform.platform}
                </span>
                {" \u00B7 "}Spread to {cluster.platforms_reached.length} platforms
              </p>
            )}
            <p>
              Total engagement: <span className="font-medium text-ink-700">{cluster.total_engagement || 0}</span>
            </p>
          </div>

          {/* Horizontal timeline */}
          {sortedTimeline.length > 0 && (
            <div className="bg-white border border-cream-200 rounded-lg p-4 overflow-x-auto">
              <div className="flex items-center gap-0 min-w-max">
                {sortedTimeline.map((node, idx) => {
                  const meta = PLATFORM_META[node.platform];
                  return (
                    <div key={node.platform} className="flex items-center">
                      <div className="flex flex-col items-center min-w-[90px]">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm"
                          style={{ backgroundColor: meta?.color || "#6B6B65" }}
                        >
                          {meta?.icon || "\u2022"}
                        </div>
                        <span className="text-[10px] font-medium text-ink-700 mt-1.5">
                          {meta?.label || node.platform}
                        </span>
                        <span className="text-[10px] text-ink-300">
                          {formatDistanceToNow(new Date(node.first_seen), { addSuffix: true })}
                        </span>
                        <span className="text-[10px] text-ink-300">
                          {node.mention_count} {node.mention_count === 1 ? "post" : "posts"}
                        </span>
                        <span className="text-[10px] text-ink-300">
                          {node.total_engagement} pts
                        </span>
                      </div>
                      {idx < sortedTimeline.length - 1 && (
                        <div className="w-8 h-0.5 bg-cream-300 shrink-0 -mt-8" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mentions grouped by platform */}
          <div className="space-y-4">
            {cluster.platforms_reached.map((platform) => {
              const platformMentions = (cluster.mentions || []).filter(
                (m) => m.source === platform
              );
              if (platformMentions.length === 0) return null;
              const meta = PLATFORM_META[platform];

              return (
                <div key={platform}>
                  <h4 className="text-xs font-medium text-ink-700 mb-2 flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: meta?.color || "#6B6B65" }}
                    />
                    {meta?.label || platform} ({platformMentions.length})
                  </h4>
                  <div className="space-y-2">
                    {platformMentions
                      .sort((a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime())
                      .map((m) => (
                        <div
                          key={m.id}
                          className="bg-white border border-cream-200 rounded-lg p-3"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {m.urgency && (
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${
                                  URGENCY_PILL[m.urgency] || URGENCY_PILL.noise
                                }`}
                              >
                                {m.urgency}
                              </span>
                            )}
                            <span className="text-[10px] text-ink-300">
                              {m.engagement_score} pts
                            </span>
                            <span className="text-[10px] text-ink-300 ml-auto">
                              {formatDistanceToNow(new Date(m.published_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm text-ink-700 line-clamp-2">
                            {m.summary || m.title || "Untitled"}
                          </p>
                          <a
                            href={m.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-accent-terracotta hover:underline mt-1 block"
                          >
                            View source
                          </a>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* High-urgency story link */}
          {cluster.has_fire && (
            <Link
              href="/dashboard"
              className="block text-center text-sm text-red-600 hover:text-red-700 border border-red-200 rounded-lg py-2.5 hover:bg-red-50 transition-colors"
            >
              {"\uD83D\uDEA8"} This story has an active incident.{" "}
              <span className="underline">Open dashboard {"\u2192"}</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
