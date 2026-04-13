"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export interface JournalistData {
  slug: string;
  name: string;
  outlet: string;
  beat?: string;
  relationship_health: "strong" | "warm" | "new" | "cold";
  total_articles: number;
  narrative_alignment?: Record<string, number>;
  recent_sentiment?: number;
  topics_of_interest?: string[];
  twitter_handle?: string;
  notes?: string;
  recent_articles?: {
    title: string;
    date: string;
    url: string;
    narrative_scores?: Record<string, number>;
  }[];
}

const HEALTH_CONFIG: Record<string, { dot: string; label: string; color: string }> = {
  strong: { dot: "bg-emerald-500", label: "Strong", color: "text-emerald-600" },
  warm: { dot: "bg-amber-400", label: "Warm", color: "text-amber-600" },
  new: { dot: "bg-blue-400", label: "New", color: "text-blue-600" },
  cold: { dot: "bg-gray-300", label: "Cold", color: "text-gray-500" },
};

interface Props {
  journalist: JournalistData;
  compact?: boolean;
  onClose?: () => void;
}

export default function JournalistCard({ journalist, compact = true, onClose }: Props) {
  const [notes, setNotes] = useState(journalist.notes || "");
  const [saving, setSaving] = useState(false);
  const j = journalist;
  const health = HEALTH_CONFIG[j.relationship_health] || HEALTH_CONFIG.cold;

  const { strongest, weakest } = useMemo(() => {
    if (!j.narrative_alignment) return { strongest: null, weakest: null };
    const entries = Object.entries(j.narrative_alignment);
    if (entries.length === 0) return { strongest: null, weakest: null };
    const sorted = [...entries].sort((a, b) => b[1] - a[1]);
    return {
      strongest: { name: sorted[0][0], rate: sorted[0][1] },
      weakest: sorted.length > 1
        ? { name: sorted[sorted.length - 1][0], rate: sorted[sorted.length - 1][1] }
        : null,
    };
  }, [j.narrative_alignment]);

  const pitchGuide = useMemo(() => {
    if (!strongest) return null;
    const topTopics = (j.topics_of_interest || []).slice(0, 2).join(", ");
    return {
      lead: strongest.name,
      avoid: weakest?.name || "N/A",
      topics: topTopics || "general coverage",
    };
  }, [strongest, weakest, j.topics_of_interest]);

  async function handleSaveNotes() {
    setSaving(true);
    try {
      await fetch(`/api/journalists/${j.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
    } catch {
      // non-critical
    }
    setSaving(false);
  }

  // Compact card
  if (compact) {
    return (
      <div className="bg-white border border-cream-200 rounded-xl p-4 hover:border-cream-300 hover:shadow-sm transition-all cursor-pointer">
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="font-display text-sm font-semibold text-ink-900">{j.name}</p>
            <p className="text-xs text-ink-400">
              {j.outlet}
              {j.beat ? ` · ${j.beat}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${health.dot}`} />
            <span className={`text-xs ${health.color}`}>{health.label}</span>
          </div>
        </div>
        <p className="text-xs text-ink-400 mb-2">{j.total_articles} articles</p>
        <div className="space-y-0.5 text-xs">
          {strongest && (
            <p className="text-ink-500">
              Strongest: <span className="text-ink-700">{strongest.name}</span>{" "}
              <span className="text-ink-300">({Math.round(strongest.rate * 100)}%)</span>
            </p>
          )}
          {weakest && (
            <p className="text-ink-500">
              Weakest: <span className="text-ink-700">{weakest.name}</span>{" "}
              <span className="text-ink-300">({Math.round(weakest.rate * 100)}%)</span>
            </p>
          )}
          {j.recent_sentiment !== undefined && (
            <p className="text-ink-500">
              Sentiment:{" "}
              <span className={j.recent_sentiment >= 0 ? "text-emerald-600" : "text-red-500"}>
                {j.recent_sentiment >= 0 ? "+" : ""}{j.recent_sentiment.toFixed(1)}
              </span>
            </p>
          )}
        </div>
      </div>
    );
  }

  // Full detail card
  const alignmentData = j.narrative_alignment
    ? Object.entries(j.narrative_alignment).map(([name, rate]) => ({
        name,
        rate: Math.round(rate * 100),
      })).sort((a, b) => b.rate - a.rate)
    : [];

  return (
    <div className="bg-white border border-cream-200 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-900">{j.name}</h2>
          <p className="text-sm text-ink-400">
            {j.outlet}
            {j.beat ? ` · ${j.beat}` : ""}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2 h-2 rounded-full ${health.dot}`} />
            <span className={`text-xs ${health.color}`}>{health.label}</span>
            <span className="text-xs text-ink-300">· {j.total_articles} articles</span>
            {j.twitter_handle && (
              <a
                href={`https://twitter.com/${j.twitter_handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent-terracotta hover:underline"
              >
                @{j.twitter_handle}
              </a>
            )}
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-ink-300 hover:text-ink-500 text-lg">&times;</button>
        )}
      </div>

      {/* Pitch guide */}
      {pitchGuide && (
        <div className="bg-cream-50 border border-cream-200 rounded-lg p-4 mb-4">
          <p className="text-xs uppercase tracking-wider text-ink-300 mb-2">Pitch guide</p>
          <p className="text-sm text-ink-700">
            <strong>Lead with:</strong> {pitchGuide.lead}.{" "}
            <strong>Avoid:</strong> {pitchGuide.avoid}.{" "}
            <strong>Recent interest:</strong> {pitchGuide.topics}.
          </p>
        </div>
      )}

      {/* Narrative alignment chart */}
      {alignmentData.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-ink-400 mb-2">Narrative alignment</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={alignmentData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#9C9A92" }} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6B6B65" }} width={100} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    return (
                      <div className="bg-white border border-cream-200 rounded-lg px-3 py-2 shadow-sm text-xs">
                        {payload[0].payload.name}: {payload[0].payload.rate}%
                      </div>
                    );
                  }}
                />
                <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                  {alignmentData.map((d, i) => (
                    <Cell key={i} fill={d.rate >= 50 ? "#10b981" : d.rate >= 25 ? "#f59e0b" : "#ef4444"} opacity={0.7} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Topics of interest */}
      {j.topics_of_interest && j.topics_of_interest.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-ink-400 mb-2">Topics of interest</p>
          <div className="flex flex-wrap gap-1.5">
            {j.topics_of_interest.map((t) => (
              <span key={t} className="text-xs bg-cream-100 text-ink-500 px-2 py-0.5 rounded-full">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent articles */}
      {j.recent_articles && j.recent_articles.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-ink-400 mb-2">Recent coverage</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {j.recent_articles.slice(0, 20).map((a, i) => (
              <div key={i} className="text-xs">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-terracotta hover:underline"
                >
                  {a.title}
                </a>
                <span className="text-ink-300 ml-2">{a.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <p className="text-xs text-ink-400 mb-2">Notes</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleSaveNotes}
          placeholder="Add notes about this journalist..."
          rows={3}
          className="w-full text-sm border border-cream-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ink-900 focus:border-transparent resize-none"
        />
        {saving && <p className="text-[10px] text-ink-300 mt-1">Saving...</p>}
      </div>
    </div>
  );
}
