"use client";

import { useEffect, useMemo } from "react";
import type { LLMResponse, LLMResponseHighlight } from "@/lib/llm-monitor-ui";
import { PLATFORM_COLORS, PLATFORM_LABELS } from "@/lib/llm-monitor-ui";

interface Props {
  response: LLMResponse;
  onClose: () => void;
}

const HIGHLIGHT_STYLES: Record<LLMResponseHighlight["type"], string> = {
  positive: "bg-emerald-50 border-b-2 border-emerald-400",
  negative: "bg-red-50 border-b-2 border-red-400",
  error: "bg-amber-100 border-b-2 border-amber-500",
  narrative: "bg-blue-50 border-b-2 border-blue-400",
};

const HIGHLIGHT_PRIORITY: Record<LLMResponseHighlight["type"], number> = {
  error: 0,
  negative: 1,
  narrative: 2,
  positive: 3,
};

function sentimentBadge(score: number) {
  if (score >= 2) return { label: `+${score} Very positive`, style: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (score >= 1) return { label: `+${score} Positive`, style: "bg-emerald-50 text-emerald-600 border-emerald-200" };
  if (score === 0) return { label: "0 Neutral", style: "bg-cream-100 text-ink-500 border-cream-200" };
  if (score >= -1) return { label: `${score} Negative`, style: "bg-red-50 text-red-600 border-red-200" };
  return { label: `${score} Very negative`, style: "bg-red-50 text-red-700 border-red-200" };
}

function rankColor(rank: number | null): string {
  if (rank === null) return "text-ink-300";
  if (rank === 1) return "text-emerald-600";
  if (rank === 2) return "text-amber-600";
  return "text-red-600";
}

/** Render response text with highlight spans */
function renderHighlightedText(
  text: string,
  highlights: LLMResponseHighlight[]
) {
  if (!highlights.length) {
    return <span className="whitespace-pre-wrap">{text}</span>;
  }

  // Sort by start, resolve overlaps by priority
  const sorted = [...highlights].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return (HIGHLIGHT_PRIORITY[a.type] ?? 9) - (HIGHLIGHT_PRIORITY[b.type] ?? 9);
  });

  // Build non-overlapping segments
  const segments: { start: number; end: number; highlight: LLMResponseHighlight | null }[] = [];
  let cursor = 0;

  for (const h of sorted) {
    if (h.start < cursor) continue; // skip overlaps
    if (h.start > cursor) {
      segments.push({ start: cursor, end: h.start, highlight: null });
    }
    segments.push({ start: h.start, end: h.end, highlight: h });
    cursor = h.end;
  }

  if (cursor < text.length) {
    segments.push({ start: cursor, end: text.length, highlight: null });
  }

  return (
    <span className="whitespace-pre-wrap">
      {segments.map((seg, i) => {
        const content = text.slice(seg.start, seg.end);
        if (!seg.highlight) return <span key={i}>{content}</span>;
        return (
          <span
            key={i}
            className={`${HIGHLIGHT_STYLES[seg.highlight.type]} cursor-help`}
            title={seg.highlight.detail}
          >
            {content}
          </span>
        );
      })}
    </span>
  );
}

export default function LLMResponseViewer({ response, onClose }: Props) {
  const color = PLATFORM_COLORS[response.platform] || "#6B6B65";
  const label = PLATFORM_LABELS[response.platform] || response.platform;
  const cls = response.classification;
  const badge = sentimentBadge(cls.sentiment);

  // Escape key to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Narrative entries
  const narrativeEntries = useMemo(
    () => Object.entries(cls.narratives),
    [cls.narratives]
  );

  // Severity styles for errors
  const severityStyle = (sev: string) => {
    if (sev === "critical") return "bg-red-50 text-red-700 border border-red-200";
    if (sev === "major") return "bg-amber-50 text-amber-700 border border-amber-200";
    return "bg-cream-100 text-ink-500 border border-cream-200";
  };

  // Sentiment gauge width (map -3..+3 to 0..100%)
  const gaugePercent = ((cls.sentiment + 3) / 6) * 100;
  const gaugeColor =
    cls.sentiment >= 1 ? "#10b981" : cls.sentiment <= -1 ? "#ef4444" : "#9C9A92";

  return (
    <div
      className="fixed inset-0 bg-black/20 z-50 flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-cream-50 h-full overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Color bar */}
        <div className="h-1" style={{ backgroundColor: color }} />

        {/* Header */}
        <div className="px-6 py-4 border-b border-cream-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <div>
              <h2 className="font-display text-base font-semibold text-ink-900">
                {label}
              </h2>
              <p className="text-[10px] text-ink-300">
                {response.model} &middot;{" "}
                {new Date(response.response_date).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-300 hover:text-ink-700 transition-colors text-lg"
          >
            &times;
          </button>
        </div>

        <div className="flex flex-col lg:flex-row">
          {/* Main content */}
          <div className="flex-1 min-w-0 px-6 py-5 space-y-5">
            {/* Question */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ink-300 mb-1">
                Question
              </p>
              <p className="font-serif text-sm text-ink-700 italic">
                &ldquo;{response.probe_prompt}&rdquo;
              </p>
              <span className="inline-block mt-1 text-[10px] bg-cream-100 text-ink-500 px-1.5 py-0.5 rounded">
                {response.probe_category}
              </span>
            </div>

            {/* Response */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ink-300 mb-2">
                Response
              </p>
              <div className="text-sm text-ink-700 leading-relaxed bg-white border border-cream-200 rounded-lg p-4">
                {renderHighlightedText(
                  response.response_text,
                  cls.highlights
                )}
              </div>
            </div>

            {/* Highlight legend */}
            {cls.highlights.length > 0 && (
              <div className="flex items-center gap-3 text-[10px] text-ink-400">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-1.5 rounded-sm bg-emerald-400" /> Positive
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-1.5 rounded-sm bg-red-400" /> Competitor favored
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-1.5 rounded-sm bg-amber-500" /> Factual error
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-1.5 rounded-sm bg-blue-400" /> Narrative
                </span>
              </div>
            )}
          </div>

          {/* Classification sidebar */}
          <div className="lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-cream-200 px-5 py-5 space-y-4">
            {/* Brand presence */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ink-300 mb-1">
                Brand Presence
              </p>
              <div className="flex items-center gap-2">
                <span className={cls.brand_mentioned ? "text-emerald-600" : "text-red-500"}>
                  {cls.brand_mentioned ? "\u2713 Mentioned" : "\u2717 Not mentioned"}
                </span>
              </div>
              <span
                className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] border ${badge.style}`}
              >
                {badge.label}
              </span>
            </div>

            {/* Rank */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ink-300 mb-1">
                Rank
              </p>
              <p className={`text-lg font-display font-semibold ${rankColor(cls.rank)}`}>
                {cls.rank ? `#${cls.rank}` : "Not ranked"}
              </p>
            </div>

            {/* Overall score gauge */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ink-300 mb-1">
                Overall Score
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-ink-300">-3</span>
                <div className="flex-1 h-2 bg-cream-200 rounded-full relative">
                  <div
                    className="absolute top-0 left-0 h-full rounded-full transition-all"
                    style={{
                      width: `${gaugePercent}%`,
                      backgroundColor: gaugeColor,
                    }}
                  />
                </div>
                <span className="text-[10px] text-ink-300">+3</span>
              </div>
              <p className="text-xs text-ink-700 font-medium text-center mt-0.5">
                {cls.sentiment > 0 ? "+" : ""}
                {cls.sentiment}
              </p>
            </div>

            {/* Narratives */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ink-300 mb-1">
                Narratives
              </p>
              {narrativeEntries.length === 0 ? (
                <p className="text-xs text-ink-300">None detected</p>
              ) : (
                <div className="space-y-1">
                  {narrativeEntries.map(([slug, val]) => (
                    <div key={slug} className="flex items-center gap-1.5 text-xs">
                      <span className={val.present ? "text-emerald-600" : "text-red-400"}>
                        {val.present ? "\u2713" : "\u2717"}
                      </span>
                      <span className="text-ink-700">{slug.replace(/-/g, " ")}</span>
                      {val.present && val.framing && (
                        <span className="text-[10px] text-ink-300">({val.framing})</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Competitors */}
            {cls.competitors_mentioned.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-ink-300 mb-1">
                  Competitors
                </p>
                <div className="space-y-1">
                  {cls.competitors_mentioned.map((c) => (
                    <div key={c} className="flex items-center gap-1.5 text-xs">
                      <span
                        className={
                          cls.competitor_favored === c
                            ? "text-red-500"
                            : "text-ink-500"
                        }
                      >
                        {cls.competitor_favored === c ? "\u2191 Favored" : c}
                      </span>
                      {cls.competitor_favored !== c && (
                        <span className="text-ink-700">{c}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            {cls.errors.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-ink-300 mb-1">
                  Factual Errors
                </p>
                <div className="space-y-2">
                  {cls.errors.map((err, i) => (
                    <div
                      key={i}
                      className="bg-red-50/50 border border-red-200 rounded-lg p-2 text-xs"
                    >
                      <span
                        className={`inline-block px-1 py-0.5 rounded text-[10px] font-medium mb-1 ${severityStyle(err.severity)}`}
                      >
                        {err.severity}
                      </span>
                      <p className="text-ink-700">
                        <span className="font-medium">Claim:</span> {err.claim}
                      </p>
                      <p className="text-ink-700">
                        <span className="font-medium">Reality:</span> {err.reality}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ink-300 mb-1">
                Analysis
              </p>
              <p className="text-xs text-ink-500 leading-relaxed">
                {cls.analysis_summary}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
