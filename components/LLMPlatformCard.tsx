"use client";

import { formatDistanceToNow } from "date-fns";
import type { LLMPlatformSummary } from "@/app/dashboard/llm-monitor/types";
import { PLATFORM_COLORS, PLATFORM_LABELS } from "@/app/dashboard/llm-monitor/types";

interface Props {
  summary: LLMPlatformSummary;
  isSelected: boolean;
  onClick: () => void;
}

function rankColor(rank: number | null): string {
  if (rank === null) return "text-ink-300";
  if (rank === 1) return "text-emerald-600";
  if (rank === 2) return "text-amber-600";
  return "text-red-600";
}

function rankLabel(rank: number | null): string {
  if (rank === null) return "Not ranked";
  return `#${rank}`;
}

export default function LLMPlatformCard({ summary, isSelected, onClick }: Props) {
  const color = PLATFORM_COLORS[summary.platform] || "#6B6B65";
  const label = PLATFORM_LABELS[summary.platform] || summary.platform;
  const hasCritical = summary.critical_error_count > 0;

  const deltaSign = summary.mention_rate_delta > 0 ? "+" : "";
  const deltaColor =
    summary.mention_rate_delta > 0
      ? "text-emerald-600"
      : summary.mention_rate_delta < 0
        ? "text-red-600"
        : "text-ink-300";
  const deltaArrow =
    summary.mention_rate_delta > 0
      ? "\u2191"
      : summary.mention_rate_delta < 0
        ? "\u2193"
        : "\u2192";

  const sentimentTrendLabel =
    summary.sentiment_trend === "improving"
      ? "\u2191 improving"
      : summary.sentiment_trend === "declining"
        ? "\u2193 declining"
        : "\u2192 stable";
  const sentimentTrendColor =
    summary.sentiment_trend === "improving"
      ? "text-emerald-600"
      : summary.sentiment_trend === "declining"
        ? "text-red-600"
        : "text-ink-300";

  return (
    <button
      onClick={onClick}
      className={`text-left w-full rounded-xl p-4 border-l-4 transition-all ${
        hasCritical ? "bg-red-50/30" : "bg-white"
      } ${
        isSelected
          ? "ring-2 ring-offset-1 shadow-sm"
          : "border border-cream-200 hover:shadow-sm"
      }`}
      style={{
        borderLeftColor: color,
        ...(isSelected ? { ["--tw-ring-color" as string]: color } : {}),
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: color }}
          />
          <span className="font-display text-sm font-semibold text-ink-900">
            {label}
          </span>
        </div>
        <span className="text-[10px] bg-cream-100 text-ink-500 px-1.5 py-0.5 rounded">
          {summary.model}
        </span>
      </div>

      {/* Metrics */}
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-ink-500">Mention rate:</span>
          <span className="text-ink-900 font-medium">
            {Math.round(summary.mention_rate)}%{" "}
            <span className={deltaColor}>
              {deltaArrow} {deltaSign}
              {Math.round(summary.mention_rate_delta)}%
            </span>
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-ink-500">Sentiment:</span>
          <span className="text-ink-900 font-medium">
            {summary.avg_sentiment > 0 ? "+" : ""}
            {summary.avg_sentiment.toFixed(1)}{" "}
            <span className={`${sentimentTrendColor}`}>{sentimentTrendLabel}</span>
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-ink-500">Avg rank:</span>
          <span className={`font-medium ${rankColor(summary.avg_rank)}`}>
            {rankLabel(summary.avg_rank)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-ink-500">Errors:</span>
          {summary.error_count === 0 ? (
            <span className="text-emerald-600 font-medium">0 &#10003;</span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  hasCritical
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {summary.error_count}
                {hasCritical && ` (${summary.critical_error_count} critical)`}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2 border-t border-cream-100 text-[10px] text-ink-300">
        Last checked:{" "}
        {summary.last_checked
          ? formatDistanceToNow(new Date(summary.last_checked), { addSuffix: true })
          : "never"}
      </div>
    </button>
  );
}
