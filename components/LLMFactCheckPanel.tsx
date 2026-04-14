"use client";

import { useState, useMemo } from "react";
import type { LLMFactError } from "@/lib/llm-monitor-ui";
import { PLATFORM_LABELS } from "@/lib/llm-monitor-ui";

interface Props {
  errors: LLMFactError[];
  onViewResponse?: (responseId: string) => void;
  onCreateIncident?: (error: LLMFactError) => void;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border border-red-200",
  major: "bg-amber-50 text-amber-700 border border-amber-200",
  minor: "bg-cream-100 text-ink-500 border border-cream-200",
};

const SEVERITY_ORDER: Record<string, number> = { critical: 0, major: 1, minor: 2 };

export default function LLMFactCheckPanel({
  errors,
  onViewResponse,
  onCreateIncident,
}: Props) {
  const [sortBy, setSortBy] = useState<"severity" | "date">("severity");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const criticalErrors = useMemo(
    () => errors.filter((e) => e.severity === "critical"),
    [errors]
  );

  const sorted = useMemo(() => {
    const copy = [...errors];
    if (sortBy === "severity") {
      copy.sort(
        (a, b) =>
          (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
      );
    } else {
      copy.sort(
        (a, b) =>
          new Date(b.response_date).getTime() -
          new Date(a.response_date).getTime()
      );
    }
    return copy;
  }, [errors, sortBy]);

  if (errors.length === 0) {
    return (
      <div className="bg-white border border-cream-200 rounded-xl p-5">
        <h3 className="font-display text-sm font-semibold text-ink-900 mb-3">
          Factual Accuracy
        </h3>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
          <p className="text-xs text-emerald-700">
            No factual errors detected in recent responses. &#10003;
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-cream-200 rounded-xl p-5">
      <h3 className="font-display text-sm font-semibold text-ink-900 mb-3">
        Factual Accuracy
      </h3>

      {/* Critical alert banner */}
      {criticalErrors.length > 0 && (
        <div className="bg-red-100 border-2 border-red-400 rounded-xl p-4 mb-4 animate-beacon">
          <div className="flex items-start gap-2">
            <span className="text-red-600 text-2xl leading-none">&#9888;&#65039;</span>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-red-900 mb-1">
                CRITICAL: {criticalErrors.length} factual error
                {criticalErrors.length !== 1 ? "s" : ""} detected
              </p>
              <p className="text-xs text-red-700 mb-2">
                Millions of users may see this inaccurate information daily.
              </p>
              {criticalErrors.slice(0, 2).map((err, i) => (
                <p key={i} className="text-xs text-red-800 mb-1 font-medium">
                  {PLATFORM_LABELS[err.platform] || err.platform} claims &ldquo;
                  {err.claim}&rdquo; &mdash; Reality: {err.reality}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sort controls */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] text-ink-300 uppercase tracking-widest">
          Sort by:
        </span>
        {(["severity", "date"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
              sortBy === s
                ? "bg-ink-900 text-white"
                : "bg-cream-100 text-ink-500 hover:bg-cream-200"
            }`}
          >
            {s === "severity" ? "Severity" : "Date"}
          </button>
        ))}
      </div>

      {/* Error list */}
      <div className="space-y-2">
        {sorted.map((err) => {
          const key = `${err.response_id}-${err.claim}`;
          const isExpanded = expandedId === key;
          return (
            <div
              key={key}
              className="border border-cream-200 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : key)}
                className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-cream-50 transition-colors"
              >
                <span
                  className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                    SEVERITY_STYLES[err.severity] || SEVERITY_STYLES.minor
                  }`}
                >
                  {err.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-ink-700 font-medium truncate">
                    {PLATFORM_LABELS[err.platform] || err.platform}:{" "}
                    &ldquo;{err.claim}&rdquo;
                  </p>
                  <p className="text-[10px] text-ink-300 mt-0.5">
                    {new Date(err.response_date).toLocaleDateString()} &middot;{" "}
                    {err.is_persistent ? "Active" : "Resolved"}
                  </p>
                </div>
                <span className="text-ink-300 text-xs shrink-0">
                  {isExpanded ? "\u25B2" : "\u25BC"}
                </span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 border-t border-cream-100 pt-3">
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-ink-300 font-medium">Claim: </span>
                      <span className="text-ink-700">{err.claim}</span>
                    </div>
                    <div>
                      <span className="text-ink-300 font-medium">Reality: </span>
                      <span className="text-ink-700">{err.reality}</span>
                    </div>
                    <div>
                      <span className="text-ink-300 font-medium">Probe: </span>
                      <span className="text-ink-500">{err.probe_prompt}</span>
                    </div>
                    <div>
                      <span className="text-ink-300 font-medium">Status: </span>
                      <span
                        className={
                          err.is_persistent
                            ? "text-red-600 font-medium"
                            : "text-emerald-600 font-medium"
                        }
                      >
                        {err.is_persistent ? "Active \u2014 still present" : "Resolved"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    {onViewResponse && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewResponse(err.response_id);
                        }}
                        className="text-[10px] text-accent-terracotta hover:underline"
                      >
                        View Response &rarr;
                      </button>
                    )}
                    {err.severity === "critical" && onCreateIncident && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCreateIncident(err);
                        }}
                        className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700 transition-colors"
                      >
                        Create Incident &rarr;
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
