"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";

export interface NarrativeData {
  slug: string;
  display_name: string;
  current_pull_through: number;
  target_pull_through: number;
  weekly_delta: number;
  top_outlet?: string;
  top_outlet_rate?: number;
  top_journalist?: string;
  framing_breakdown?: { gain: number; neutral: number; loss: number };
  weekly_trend?: number[];
}

interface Props {
  narratives: NarrativeData[];
  onSelect: (slug: string) => void;
}

function framingIndicator(fb?: { gain: number; neutral: number; loss: number }): string {
  if (!fb || (fb.gain === 0 && fb.loss === 0)) return "🟡 neutral";
  if (fb.gain > fb.loss * 2) return "🟢 gain";
  if (fb.loss > fb.gain * 2) return "🔴 loss";
  return "🟡 neutral";
}

export default function NarrativeScorecard({ narratives, onSelect }: Props) {
  // Sort: worst gap to target first
  const sorted = [...narratives].sort(
    (a, b) =>
      (b.target_pull_through - b.current_pull_through) -
      (a.target_pull_through - a.current_pull_through)
  );

  if (sorted.length === 0) {
    return (
      <div className="bg-white border border-cream-200 rounded-xl p-8 text-center">
        <p className="text-sm text-ink-300">No narrative priorities configured yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((n) => {
        const pct = Math.round(n.current_pull_through * 100);
        const targetPct = Math.round(n.target_pull_through * 100);
        const aboveTarget = n.current_pull_through >= n.target_pull_through;
        const barColor = aboveTarget ? "#10b981" : "#C55A3A";
        const delta = Math.round((n.weekly_delta ?? 0) * 100);

        const sparkData = (n.weekly_trend || []).map((v, i) => ({ i, v: v * 100 }));

        return (
          <button
            key={n.slug}
            onClick={() => onSelect(n.slug)}
            className="w-full text-left bg-white border border-cream-200 rounded-xl p-5 hover:border-cream-300 hover:shadow-sm transition-all"
          >
            {/* Top row: name + percentage */}
            <div className="flex items-center justify-between mb-2">
              <span className="font-display text-sm font-semibold text-ink-900">
                {n.display_name}
              </span>
              <div className="flex items-center gap-3">
                {sparkData.length > 1 && (
                  <div className="w-20 h-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sparkData}>
                        <Line
                          type="monotone"
                          dataKey="v"
                          stroke="#C55A3A"
                          strokeWidth={1.5}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <span
                  className="font-mono text-2xl font-semibold"
                  style={{ color: barColor }}
                >
                  {pct}%
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-cream-100 rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(pct, 100)}%`,
                  backgroundColor: barColor,
                  opacity: 0.4 + n.current_pull_through * 0.6,
                }}
              />
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-3 text-xs text-ink-400 flex-wrap">
              <span>Target: {targetPct}%</span>

              {delta !== 0 ? (
                <span className={delta > 0 ? "text-emerald-600" : "text-red-500"}>
                  {delta > 0 ? "↑" : "↓"} {delta > 0 ? "+" : ""}{delta}pp this week
                </span>
              ) : (
                <span className="text-ink-300">— no change</span>
              )}

              <span>{framingIndicator(n.framing_breakdown)}</span>

              {n.top_outlet && (
                <>
                  <span className="text-ink-300">·</span>
                  <span>Top: {n.top_outlet}</span>
                </>
              )}

              {n.top_journalist && (
                <>
                  <span className="text-ink-300">·</span>
                  <span>{n.top_journalist}</span>
                </>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
