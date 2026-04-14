"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { LLMMonitoringSnapshot } from "@/lib/llm-monitor-ui";
import { PLATFORM_COLORS, PLATFORM_LABELS } from "@/lib/llm-monitor-ui";

type Metric = "mention_rate" | "avg_sentiment" | "avg_rank" | "error_count";

interface Props {
  snapshots: LLMMonitoringSnapshot[];
  metric: Metric;
  onMetricChange: (m: Metric) => void;
}

const METRIC_LABELS: Record<Metric, string> = {
  mention_rate: "Mention Rate",
  avg_sentiment: "Sentiment",
  avg_rank: "Avg Rank",
  error_count: "Errors",
};

function yAxisConfig(metric: Metric) {
  switch (metric) {
    case "mention_rate":
      return { domain: [0, 100] as [number, number], formatter: (v: number) => `${v}%` };
    case "avg_sentiment":
      return { domain: [-3, 3] as [number, number], formatter: (v: number) => `${v > 0 ? "+" : ""}${v}` };
    case "avg_rank":
      return { domain: undefined, formatter: (v: number) => `#${v}`, reversed: true };
    case "error_count":
      return { domain: [0, "auto"] as [number, string], formatter: (v: number) => `${v}` };
    default:
      return { domain: undefined, formatter: (v: number) => `${v}` };
  }
}

export default function LLMTrendChart({ snapshots, metric, onMetricChange }: Props) {
  const platforms = useMemo(() => {
    const set = new Set<string>();
    for (const s of snapshots) set.add(s.platform);
    return Array.from(set);
  }, [snapshots]);

  // Pivot: group by week, one key per platform
  const chartData = useMemo(() => {
    const byWeek = new Map<string, Record<string, number | string>>();

    for (const s of snapshots) {
      if (!byWeek.has(s.week_start)) {
        byWeek.set(s.week_start, { week: s.week_start });
      }
      const row = byWeek.get(s.week_start)!;
      const val =
        metric === "mention_rate"
          ? Math.round(s.mention_rate * 100)
          : metric === "avg_rank"
            ? s.avg_rank ?? 0
            : s[metric];
      row[s.platform] = val;
    }

    return Array.from(byWeek.values()).sort(
      (a, b) => new Date(a.week as string).getTime() - new Date(b.week as string).getTime()
    );
  }, [snapshots, metric]);

  const yConfig = yAxisConfig(metric);

  if (snapshots.length === 0) {
    return (
      <div className="bg-white border border-cream-200 rounded-xl p-5">
        <h3 className="font-display text-sm font-semibold text-ink-900 mb-3">
          Trends
        </h3>
        <div className="py-8 text-center">
          <p className="text-sm text-ink-300">No trend data available yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-cream-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm font-semibold text-ink-900">
          Trends
        </h3>
        {/* Metric selector */}
        <div className="flex items-center gap-1">
          {(Object.keys(METRIC_LABELS) as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => onMetricChange(m)}
              className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${
                metric === m
                  ? "bg-ink-900 text-white"
                  : "bg-cream-100 text-ink-500 hover:bg-cream-200"
              }`}
            >
              {METRIC_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEECE5" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: "#9C9A92" }}
              tickLine={false}
              axisLine={{ stroke: "#EEECE5" }}
              tickFormatter={(v) => {
                const d = new Date(v);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
            />
            <YAxis
              domain={yConfig.domain as [number, number] | undefined}
              tick={{ fontSize: 11, fill: "#9C9A92" }}
              tickLine={false}
              axisLine={{ stroke: "#EEECE5" }}
              tickFormatter={yConfig.formatter}
              reversed={metric === "avg_rank"}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-white border border-cream-200 rounded-lg px-3 py-2 shadow-sm text-xs">
                    <p className="font-medium text-ink-900 mb-1">
                      Week of {label}
                    </p>
                    {payload.map((entry) => {
                      const key = String(entry.dataKey ?? "");
                      return (
                        <p
                          key={key}
                          className="flex items-center gap-1.5"
                        >
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-ink-500">
                            {PLATFORM_LABELS[key] || key}:
                          </span>
                          <span className="text-ink-900 font-medium">
                            {yConfig.formatter(entry.value as number)}
                          </span>
                        </p>
                      );
                    })}
                  </div>
                );
              }}
            />
            {metric === "avg_sentiment" && (
              <ReferenceLine
                y={0}
                stroke="#9C9A92"
                strokeDasharray="6 4"
              />
            )}
            {platforms.map((p) => (
              <Line
                key={p}
                type="monotone"
                dataKey={p}
                stroke={PLATFORM_COLORS[p] || "#6B6B65"}
                strokeWidth={2}
                dot={{ r: 3, fill: PLATFORM_COLORS[p] || "#6B6B65", stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[10px] text-ink-400">
        {platforms.map((p) => (
          <span key={p} className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: PLATFORM_COLORS[p] || "#6B6B65" }}
            />
            {PLATFORM_LABELS[p] || p}
          </span>
        ))}
      </div>
    </div>
  );
}
