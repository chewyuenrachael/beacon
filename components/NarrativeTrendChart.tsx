"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";

export interface TrendSnapshot {
  week: string;
  pull_through: number;
  scored: number;
  landed: number;
  gain: number;
  neutral: number;
  loss: number;
}

interface Props {
  snapshots: TrendSnapshot[];
  target: number;
  narrativeName: string;
}

export default function NarrativeTrendChart({ snapshots, target, narrativeName }: Props) {
  if (snapshots.length === 0) {
    return (
      <div className="bg-white border border-cream-200 rounded-xl p-8 text-center">
        <p className="text-sm text-ink-300">No trend data available yet for {narrativeName}.</p>
      </div>
    );
  }

  const chartData = snapshots.map((s) => ({
    ...s,
    pct: Math.round(s.pull_through * 100),
    targetPct: Math.round(target * 100),
  }));

  const targetPct = Math.round(target * 100);

  return (
    <div className="space-y-4">
      {/* Main trend chart */}
      <div className="bg-white border border-cream-200 rounded-xl p-5">
        <h3 className="font-display text-sm font-semibold text-ink-900 mb-4">
          Pull-through trend — {narrativeName}
        </h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEECE5" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: "#9C9A92" }}
                tickLine={false}
                axisLine={{ stroke: "#EEECE5" }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "#9C9A92" }}
                tickLine={false}
                axisLine={{ stroke: "#EEECE5" }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white border border-cream-200 rounded-lg px-3 py-2 shadow-sm text-xs">
                      <p className="font-medium text-ink-900">Week of {d.week}</p>
                      <p className="text-ink-500">
                        {d.pct}% pull-through ({d.landed}/{d.scored} articles)
                      </p>
                    </div>
                  );
                }}
              />
              <ReferenceLine
                y={targetPct}
                stroke="#9C9A92"
                strokeDasharray="6 4"
                label={{
                  value: `Target: ${targetPct}%`,
                  position: "insideTopRight",
                  fontSize: 10,
                  fill: "#9C9A92",
                }}
              />
              <Area
                type="monotone"
                dataKey="pct"
                fill="#C55A3A"
                fillOpacity={0.08}
                stroke="none"
              />
              <Line
                type="monotone"
                dataKey="pct"
                stroke="#C55A3A"
                strokeWidth={2}
                dot={{ r: 3, fill: "#C55A3A", stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Framing breakdown bars */}
      {snapshots.some((s) => s.gain + s.neutral + s.loss > 0) && (
        <div className="bg-white border border-cream-200 rounded-xl p-5">
          <h3 className="font-display text-sm font-semibold text-ink-900 mb-4">
            Framing trend
          </h3>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 10, fill: "#9C9A92" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white border border-cream-200 rounded-lg px-3 py-2 shadow-sm text-xs">
                        <p className="font-medium text-ink-900">{d.week}</p>
                        <p className="text-emerald-600">Gain: {d.gain}</p>
                        <p className="text-ink-400">Neutral: {d.neutral}</p>
                        <p className="text-red-500">Loss: {d.loss}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="gain" stackId="framing" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="neutral" stackId="framing" fill="#E0DDD4" />
                <Bar dataKey="loss" stackId="framing" fill="#ef4444" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-ink-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> Gain</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-cream-300" /> Neutral</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500" /> Loss</span>
          </div>
        </div>
      )}
    </div>
  );
}
