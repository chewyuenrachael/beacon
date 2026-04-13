"use client";

import { useEffect, useState, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import type { MentionRow } from "@/lib/types";
import MentionCard from "@/components/MentionCard";
import { PageLoadingSkeleton, SkeletonChart, SkeletonCard } from "@/components/LoadingSkeleton";

const SOURCE_COLORS: Record<string, string> = {
  hackernews: "#f97316",
  reddit: "#3b82f6",
  youtube: "#ef4444",
  rss: "#6b7280",
};

const URGENCY_BADGE: Record<string, string> = {
  fire: "bg-red-50 text-red-700 border border-red-200",
  moment: "bg-amber-50 text-amber-700 border border-amber-200",
  signal: "bg-blue-50 text-blue-700 border border-blue-200",
  noise: "bg-cream-100 text-ink-500 border border-cream-200",
};

const TENSION_LABELS: Record<string, string> = {
  learning_vs_atrophy: "Learning vs Atrophy",
  time_savings_vs_treadmill: "Time vs Treadmill",
  empowerment_vs_displacement: "Empowerment vs Displacement",
  decision_support_vs_erosion: "Decision vs Erosion",
  productivity_vs_dependency: "Productivity vs Dependency",
};

const TENSION_TYPES = Object.keys(TENSION_LABELS);

export default function TensionsPage() {
  const [mentions, setMentions] = useState<MentionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMention, setSelectedMention] = useState<MentionRow | null>(null);
  const [hideNeutral, setHideNeutral] = useState(true);

  useEffect(() => {
    document.title = "Tensions — Beacon";
  }, []);

  useEffect(() => {
    fetch("/api/mentions?limit=500&time_range=30d")
      .then((res) => res.json())
      .then((json) => {
        const data = json.data || json;
        if (Array.isArray(data)) setMentions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredMentions = useMemo(() => {
    if (!hideNeutral) return mentions;
    return mentions.filter((m) => m.hope_score !== 0 || m.concern_score !== 0);
  }, [mentions, hideNeutral]);

  const scatterData = useMemo(
    () =>
      filteredMentions.map((m) => ({
        x: m.hope_score + (Math.random() - 0.5) * 0.15,
        y: m.concern_score + (Math.random() - 0.5) * 0.15,
        size: Math.max(Math.log(m.engagement_score + 1) * 10, 6),
        fill: SOURCE_COLORS[m.source] || "#6b7280",
        id: m.id,
        summary: m.summary || m.title || "",
        source: m.source,
        mention: m,
      })),
    [filteredMentions]
  );

  const tensionCounts = useMemo(
    () =>
      TENSION_TYPES.map((t) => ({
        name: TENSION_LABELS[t],
        count: mentions.filter((m) => m.tension_type === t).length,
      })),
    [mentions]
  );

  const hasTensions = tensionCounts.some((t) => t.count > 0);

  const tensionMentions = useMemo(
    () => mentions.filter((m) => m.tension_type && m.tension_type !== "none"),
    [mentions]
  );

  function handleDotClick(data: { mention: MentionRow }) {
    setSelectedMention(data.mention);
  }

  if (loading) {
    return (
      <div className="max-w-5xl">
        <PageLoadingSkeleton title="Hope x Concern Analysis">
          <div className="flex gap-6">
            <div className="flex-1 min-w-0 space-y-6">
              <SkeletonChart height={400} />
              <SkeletonChart height={200} />
              <SkeletonCard height={160} />
            </div>
            <div className="w-[320px] shrink-0">
              <SkeletonCard height={300} />
            </div>
          </div>
        </PageLoadingSkeleton>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-lg font-semibold text-ink-900 mb-6">
        Hope x Concern Analysis
      </h1>

      <div className="flex gap-6">
        {/* Left column: charts */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Scatter plot */}
          <div className="bg-white border border-cream-200 rounded-xl p-4">
            {/* Hide neutral toggle */}
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideNeutral}
                  onChange={() => setHideNeutral(!hideNeutral)}
                  className="rounded border-cream-300 text-ink-900 focus:ring-ink-900 h-3.5 w-3.5"
                />
                <span className="text-xs text-ink-500">Hide neutral (0,0) mentions</span>
              </label>
              <span className="text-xs text-ink-300">{filteredMentions.length} mentions</span>
            </div>

            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEECE5" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Hope"
                  domain={[0, 3]}
                  ticks={[0, 1, 2, 3]}
                  label={{ value: "Hope", position: "bottom", offset: 0, style: { fontSize: 12, fill: "#9C9A92" } }}
                  stroke="#E0DDD4"
                  fontSize={11}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Concern"
                  domain={[0, 3]}
                  ticks={[0, 1, 2, 3]}
                  label={{ value: "Concern", angle: -90, position: "left", offset: 0, style: { fontSize: 12, fill: "#9C9A92" } }}
                  stroke="#E0DDD4"
                  fontSize={11}
                />
                {/* Quadrant backgrounds */}
                <ReferenceArea x1={0} x2={1.5} y1={0} y2={1.5} fill="#F9FAFB" fillOpacity={0.5} label={{ value: "Neutral", position: "center", style: { fontSize: 11, fill: "#9C9A92" } }} />
                <ReferenceArea x1={1.5} x2={3} y1={0} y2={1.5} fill="#ECFDF5" fillOpacity={0.5} label={{ value: "Enthusiasm", position: "center", style: { fontSize: 11, fill: "#059669" } }} />
                <ReferenceArea x1={0} x2={1.5} y1={1.5} y2={3} fill="#FFF1F2" fillOpacity={0.5} label={{ value: "Alarms", position: "center", style: { fontSize: 11, fill: "#e11d48" } }} />
                <ReferenceArea x1={1.5} x2={3} y1={1.5} y2={3} fill="#F5F3FF" fillOpacity={0.5} label={{ value: "Tensions", position: "center", style: { fontSize: 11, fill: "#9333ea" } }} />
                <Tooltip
                  content={({ payload }) => {
                    if (!payload?.[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white border border-cream-200 rounded-lg p-2 shadow-sm max-w-xs">
                        <p className="text-xs text-ink-300 mb-1">{d.source}</p>
                        <p className="text-xs text-ink-700 line-clamp-2">{d.summary}</p>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={scatterData}
                  onClick={(data) => {
                    if (data?.payload) handleDotClick(data.payload);
                  }}
                >
                  {scatterData.map((entry) => (
                    <Cell
                      key={entry.id}
                      fill={entry.fill}
                      stroke={selectedMention?.id === entry.id ? "#1A1A1A" : "none"}
                      strokeWidth={selectedMention?.id === entry.id ? 2 : 0}
                      r={selectedMention?.id === entry.id ? 8 : entry.size}
                      className="cursor-pointer opacity-70 hover:opacity-100"
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 mt-2">
              {Object.entries(SOURCE_COLORS).map(([source, color]) => (
                <span key={source} className="flex items-center gap-1 text-xs text-ink-500">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  {source}
                </span>
              ))}
            </div>
          </div>

          {/* Tension type bar chart */}
          <div className="bg-white border border-cream-200 rounded-xl p-4">
            <h2 className="font-display text-sm font-medium text-ink-700 mb-4">
              Tension Types
            </h2>
            {hasTensions ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={tensionCounts} layout="vertical" margin={{ left: 160 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEECE5" horizontal={false} />
                  <XAxis type="number" stroke="#E0DDD4" fontSize={11} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#E0DDD4"
                    fontSize={11}
                    width={155}
                    tick={{ fill: "#6B6B65" }}
                  />
                  <Bar dataKey="count" fill="#a855f7" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8">
                <p className="text-ink-500 text-sm">No tensions detected in this time range.</p>
                <p className="text-ink-300 text-xs mt-1">
                  Tensions appear when developers express both hope and concern
                  simultaneously — the most nuanced signal in developer discourse.
                </p>
              </div>
            )}
          </div>

          {/* Tension feed */}
          <div>
            <h2 className="font-display text-sm font-medium text-ink-700 mb-3">
              Mentions with Tensions ({tensionMentions.length})
            </h2>
            {tensionMentions.length === 0 ? (
              <div className="bg-white border border-cream-200 rounded-xl p-8 text-center">
                <p className="text-sm text-ink-300">
                  No tensions detected yet. Tensions appear when mentions have both
                  high hope (≥2) and high concern (≥2) scores.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tensionMentions.map((m) => (
                  <MentionCard key={m.id} mention={m} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: detail panel */}
        <div className="w-[320px] shrink-0">
          <div className="sticky top-5">
            {selectedMention ? (
              <div className="bg-white border border-cream-200 rounded-xl p-6 space-y-4">
                {/* Urgency + Source + Time */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedMention.urgency && (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${URGENCY_BADGE[selectedMention.urgency] || URGENCY_BADGE.noise}`}>
                        {selectedMention.urgency}
                      </span>
                    )}
                    <span className="text-xs text-ink-300 uppercase tracking-wider">
                      {selectedMention.source === "rss" && selectedMention.author
                        ? selectedMention.author
                        : selectedMention.source}
                    </span>
                  </div>
                  <span className="text-xs text-ink-300">
                    {formatDistanceToNow(new Date(selectedMention.published_at), { addSuffix: true })}
                  </span>
                </div>

                {/* Summary */}
                <p className="font-serif text-[15px] text-ink-900 leading-relaxed font-medium">
                  {selectedMention.summary || selectedMention.title}
                </p>

                {/* Hope / Concern */}
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-ink-300">Hope</span>
                    {[1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={`w-2 h-2 rounded-full ${
                          i <= selectedMention.hope_score ? "bg-emerald-500" : "bg-cream-200"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-ink-300">Concern</span>
                    {[1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={`w-2 h-2 rounded-full ${
                          i <= selectedMention.concern_score ? "bg-rose-500" : "bg-cream-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Tension type */}
                {selectedMention.tension_type && selectedMention.tension_type !== "none" && (
                  <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                    <span className="text-xs text-purple-700 font-medium">
                      {selectedMention.tension_type.replace(/_/g, " ").replace(/vs/g, "\u2194")}
                    </span>
                  </div>
                )}

                {/* Emotion */}
                {selectedMention.primary_emotion && (
                  <div>
                    <span className="text-xs px-2 py-0.5 bg-cream-100 text-ink-500 rounded-full">
                      {selectedMention.primary_emotion}
                    </span>
                  </div>
                )}

                {/* Recommended action */}
                {selectedMention.recommended_action && (
                  <p className="text-sm text-ink-500 italic">
                    {selectedMention.recommended_action}
                  </p>
                )}

                {/* Engagement */}
                <p className="text-xs text-ink-300">
                  {selectedMention.engagement_score} engagements
                </p>

                {/* Links */}
                <div className="flex items-center gap-4 pt-2 border-t border-cream-200">
                  <a
                    href={selectedMention.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent-terracotta hover:underline"
                  >
                    View source &#8599;
                  </a>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-cream-200 rounded-xl p-8 text-center">
                <p className="text-sm text-ink-300">
                  Click a mention on the chart to see details
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
