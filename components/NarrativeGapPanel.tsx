"use client";

import { useState } from "react";

export interface NarrativeGapData {
  id: string;
  theme: string;
  description: string;
  mention_count: number;
  recommendation: string;
  recommendation_type: "amplify" | "counter" | "monitor";
  sample_urls?: string[];
  status: "new" | "reviewing" | "adopted" | "dismissed";
  dismissed_reason?: string;
  adopted_narrative_slug?: string;
}

const STATUS_CONFIG: Record<string, { icon: string; label: string; bg: string; text: string }> = {
  new: { icon: "🆕", label: "New", bg: "bg-amber-50", text: "text-amber-700" },
  reviewing: { icon: "🔍", label: "Reviewing", bg: "bg-blue-50", text: "text-blue-700" },
  adopted: { icon: "✅", label: "Adopted", bg: "bg-emerald-50", text: "text-emerald-700" },
  dismissed: { icon: "❌", label: "Dismissed", bg: "bg-gray-50", text: "text-gray-500" },
};

const REC_LABELS: Record<string, string> = {
  amplify: "AMPLIFY",
  counter: "COUNTER",
  monitor: "MONITOR",
};

interface Props {
  gaps: NarrativeGapData[];
  onStatusChange: (gapId: string, status: string, reason?: string) => void;
}

export default function NarrativeGapPanel({ gaps, onStatusChange }: Props) {
  const [showDismissed, setShowDismissed] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [dismissReason, setDismissReason] = useState("");

  const activeGaps = gaps.filter((g) => g.status !== "dismissed");
  const dismissedGaps = gaps.filter((g) => g.status === "dismissed");

  function handleDismiss(id: string) {
    onStatusChange(id, "dismissed", dismissReason);
    setDismissingId(null);
    setDismissReason("");
  }

  if (gaps.length === 0) {
    return (
      <div className="bg-white border border-cream-200 rounded-xl p-6">
        <h3 className="font-display text-sm font-semibold text-ink-900 mb-2">
          🔭 Emerging Narratives
        </h3>
        <p className="text-xs text-ink-300">
          No emerging narratives detected yet. Gap analysis runs automatically after each ingestion cycle.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-display text-sm font-semibold text-ink-900">
          🔭 Emerging Narratives
        </h3>
        <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
          {activeGaps.length}
        </span>
      </div>

      <div className="space-y-3">
        {activeGaps.map((gap) => {
          const status = STATUS_CONFIG[gap.status] || STATUS_CONFIG.new;

          return (
            <div
              key={gap.id}
              className="bg-white border border-cream-200 rounded-xl p-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                    {status.icon} {status.label}
                  </span>
                  {gap.status === "adopted" && gap.adopted_narrative_slug && (
                    <span className="text-[10px] text-emerald-600">
                      → {gap.adopted_narrative_slug}
                    </span>
                  )}
                </div>
                <span className="text-xs text-ink-300">
                  {gap.mention_count} mentions
                </span>
              </div>

              {/* Theme + description */}
              <p className="font-display text-sm font-medium text-ink-900 mb-1">
                {gap.theme}
              </p>
              <p className="text-xs text-ink-500 mb-2 leading-relaxed">
                {gap.description}
              </p>

              {/* Recommendation */}
              <div className="bg-cream-50 rounded-lg px-3 py-2 mb-3">
                <p className="text-[10px] uppercase tracking-wider text-ink-300 mb-1">
                  Recommendation: {REC_LABELS[gap.recommendation_type] || gap.recommendation_type}
                </p>
                <p className="text-xs text-ink-700">{gap.recommendation}</p>
              </div>

              {/* Sample URLs */}
              {gap.sample_urls && gap.sample_urls.length > 0 && (
                <div className="flex gap-2 mb-3">
                  {gap.sample_urls.slice(0, 3).map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-accent-terracotta hover:underline"
                    >
                      Sample {i + 1}
                    </a>
                  ))}
                </div>
              )}

              {/* Actions */}
              {gap.status !== "adopted" && (
                <div className="flex items-center gap-2">
                  {dismissingId === gap.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={dismissReason}
                        onChange={(e) => setDismissReason(e.target.value)}
                        placeholder="Reason for dismissing..."
                        className="flex-1 text-xs border border-cream-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ink-900 focus:border-transparent"
                        autoFocus
                      />
                      <button
                        onClick={() => handleDismiss(gap.id)}
                        className="text-xs bg-ink-900 text-white px-3 py-1.5 rounded-md hover:bg-ink-700"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => { setDismissingId(null); setDismissReason(""); }}
                        className="text-xs text-ink-300 hover:text-ink-500"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => onStatusChange(gap.id, "adopted")}
                        className="text-xs bg-ink-900 text-white px-3 py-1.5 rounded-md hover:bg-ink-700 transition-colors"
                      >
                        Adopt as Priority
                      </button>
                      <button
                        onClick={() => setDismissingId(gap.id)}
                        className="text-xs border border-cream-200 px-3 py-1.5 rounded-md text-ink-500 hover:bg-cream-50 transition-colors"
                      >
                        Dismiss
                      </button>
                      {gap.status === "new" && (
                        <button
                          onClick={() => onStatusChange(gap.id, "reviewing")}
                          className="text-xs text-ink-300 hover:text-ink-500 transition-colors"
                        >
                          Mark Reviewing
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dismissed section */}
      {dismissedGaps.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowDismissed(!showDismissed)}
            className="text-xs text-ink-300 hover:text-ink-500 transition-colors"
          >
            {showDismissed ? "Hide" : "Show"} {dismissedGaps.length} dismissed
          </button>
          {showDismissed && (
            <div className="mt-2 space-y-2">
              {dismissedGaps.map((gap) => (
                <div
                  key={gap.id}
                  className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 opacity-60"
                >
                  <p className="text-xs text-ink-500">
                    ❌ {gap.theme}
                  </p>
                  {gap.dismissed_reason && (
                    <p className="text-[10px] text-ink-300 mt-0.5">
                      Reason: {gap.dismissed_reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
