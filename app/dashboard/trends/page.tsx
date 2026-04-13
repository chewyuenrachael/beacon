"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { format, subDays, startOfDay, isAfter } from "date-fns";
import type { MentionRow } from "@/lib/types";
import { SkeletonChart, LoadingEllipsis } from "@/components/LoadingSkeleton";

const SOURCE_TIERS: Record<string, { sources?: string[]; authors?: string[] }> = {
  community: {
    sources: ["hackernews", "reddit"],
    authors: [
      "Simon Willison", "Latent Space", "The Pragmatic Engineer",
      "Changelog", "TLDR", "Hacker Newsletter", "ByteByteGo",
      "Interconnects", "One Useful Thing (Ethan Mollick)",
      "Crunchbase News", "Product Hunt",
    ],
  },
  press: {
    authors: [
      "TechCrunch", "TechCrunch AI", "The Verge", "The Verge AI",
      "Ars Technica", "Wired", "VentureBeat", "The Register",
      "MIT Tech Review", "NYT Technology",
    ],
  },
  official: {
    authors: ["Anthropic Blog", "OpenAI Blog", "Google AI Blog", "NVIDIA AI Blog"],
  },
  research: {
    authors: [
      "MIT News AI", "arXiv cs.CL", "arXiv cs.LG",
      "Towards Data Science", "IEEE Spectrum AI", "DeepMind Blog",
    ],
  },
  video: {
    sources: ["youtube"],
  },
};

const TIER_COLORS: Record<string, string> = {
  community: "#60a5fa",
  press: "#fbbf24",
  research: "#c084fc",
  official: "#34d399",
  video: "#fb7185",
};

const TIER_LABELS: Record<string, string> = {
  community: "Community",
  press: "Press",
  research: "Research",
  official: "Official",
  video: "Video",
};


function mentionMatchesTier(m: MentionRow, tier: string): boolean {
  const config = SOURCE_TIERS[tier];
  if (!config) return false;
  const matchesSource = config.sources?.includes(m.source) || false;
  const matchesAuthor = config.authors?.includes(m.author || "") || false;
  return matchesSource || matchesAuthor;
}

function getMentionTier(m: MentionRow): string | null {
  for (const tier of Object.keys(SOURCE_TIERS)) {
    if (mentionMatchesTier(m, tier)) return tier;
  }
  return null;
}

function formatTopicLabel(topic: string): string {
  return topic
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function TrendsPage() {
  const [mentions, setMentions] = useState<MentionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Trends — Beacon";
  }, []);

  useEffect(() => {
    fetch("/api/mentions?limit=1000&time_range=30d")
      .then((res) => res.json())
      .then((json) => {
        setMentions(json.data || json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="font-display text-lg font-semibold text-ink-900 mb-6">Trends</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonChart key={i} height={340} />
          ))}
        </div>
        <LoadingEllipsis />
      </div>
    );
  }

  const today = startOfDay(new Date());

  // ── Chart 1: Sentiment Trend (30-day daily avg) ──
  const sentimentMap = new Map<string, { hope: number[]; concern: number[] }>();
  for (let i = 29; i >= 0; i--) {
    const key = format(subDays(today, i), "yyyy-MM-dd");
    sentimentMap.set(key, { hope: [], concern: [] });
  }
  for (const m of mentions) {
    const key = format(new Date(m.published_at), "yyyy-MM-dd");
    const entry = sentimentMap.get(key);
    if (!entry) continue;
    entry.hope.push(m.hope_score);
    entry.concern.push(m.concern_score);
  }
  const sentimentData = Array.from(sentimentMap.entries()).map(([date, d]) => ({
    date: format(new Date(date), "MMM d"),
    avgHope: d.hope.length ? +(d.hope.reduce((a, b) => a + b, 0) / d.hope.length).toFixed(2) : 0,
    avgConcern: d.concern.length ? +(d.concern.reduce((a, b) => a + b, 0) / d.concern.length).toFixed(2) : 0,
    mentionCount: d.hope.length,
  }));

  // ── Chart 2: Coverage Distribution (30-day daily tier counts) ──
  const coverageMap = new Map<string, Record<string, number>>();
  for (let i = 29; i >= 0; i--) {
    const key = format(subDays(today, i), "yyyy-MM-dd");
    coverageMap.set(key, { community: 0, press: 0, research: 0, official: 0, video: 0 });
  }
  for (const m of mentions) {
    const key = format(new Date(m.published_at), "yyyy-MM-dd");
    const entry = coverageMap.get(key);
    if (!entry) continue;
    const tier = getMentionTier(m);
    if (tier && entry[tier] !== undefined) {
      entry[tier]++;
    }
  }
  const coverageData = Array.from(coverageMap.entries()).map(([date, tiers]) => ({
    date: format(new Date(date), "MMM d"),
    ...tiers,
  }));

  // ── Chart 3: Top Topics This Week (7-day frequency) with week-over-week ──
  const sevenDaysAgo = subDays(today, 7);
  const fourteenDaysAgo = subDays(today, 14);
  const topicCountsThisWeek = new Map<string, number>();
  const topicCountsLastWeek = new Map<string, number>();
  for (const m of mentions) {
    if (!m.topics) continue;
    const pubDate = new Date(m.published_at);
    const validTopics = m.topics.filter((t) => t && t.trim() !== "" && t !== "undefined");
    if (isAfter(pubDate, sevenDaysAgo)) {
      for (const topic of validTopics) {
        topicCountsThisWeek.set(topic, (topicCountsThisWeek.get(topic) || 0) + 1);
      }
    } else if (isAfter(pubDate, fourteenDaysAgo)) {
      for (const topic of validTopics) {
        topicCountsLastWeek.set(topic, (topicCountsLastWeek.get(topic) || 0) + 1);
      }
    }
  }
  const topicData = Array.from(topicCountsThisWeek.entries())
    .map(([topic, count]) => {
      const lastWeek = topicCountsLastWeek.get(topic) || 0;
      let trend: "up" | "down" | "same";
      if (count > lastWeek) trend = "up";
      else if (count < lastWeek) trend = "down";
      else trend = "same";
      return { name: formatTopicLabel(topic), count, trend };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // ── Chart 4: Fire Frequency (30-day daily) ──
  const fireMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    fireMap.set(format(subDays(today, i), "yyyy-MM-dd"), 0);
  }
  for (const m of mentions) {
    if (m.urgency !== "fire") continue;
    const key = format(new Date(m.published_at), "yyyy-MM-dd");
    if (fireMap.has(key)) {
      fireMap.set(key, fireMap.get(key)! + 1);
    }
  }
  const fireData = Array.from(fireMap.entries()).map(([date, count]) => ({
    date: format(new Date(date), "MMM d"),
    fires: count || null, // null so recharts skips zero-height bars
  }));
  const fireDays = Array.from(fireMap.values());
  const avgFires = fireDays.length > 0
    ? +(fireDays.reduce((a, b) => a + b, 0) / fireDays.length).toFixed(1)
    : 0;

  const daysWithData = sentimentData.filter((d) => d.mentionCount > 0).length;
  const hasEnoughData = daysWithData >= 2;
  const hasFireData = fireDays.some((d) => d > 0);
  const noDataMessage = "Not enough data yet. Trends require at least 2 days of data.";

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-ink-900 mb-6">Trends</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Sentiment Trend */}
        <div className="bg-white border border-cream-200 rounded-xl p-6">
          <h2 className="font-display text-base font-semibold text-ink-900 mb-4">
            Sentiment Trend
          </h2>
          {!hasEnoughData ? (
            <div className="flex items-center justify-center h-[256px]">
              <p className="text-sm text-ink-300 text-center">{noDataMessage}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={256}>
              <AreaChart data={sentimentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEECE5" />
                <XAxis dataKey="date" stroke="#E0DDD4" fontSize={11} tick={{ fill: "#9C9A92" }} />
                <YAxis domain={["auto", "auto"]} stroke="#E0DDD4" fontSize={11} />
                <Tooltip
                  contentStyle={{ fontSize: 12, border: "1px solid #EEECE5", borderRadius: 8 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const mentionCount = payload[0]?.payload?.mentionCount ?? 0;
                    return (
                      <div style={{ background: "#fff", border: "1px solid #EEECE5", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                        <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
                        {payload.map((entry) => (
                          <p key={entry.name} style={{ color: entry.color }}>
                            {entry.name}: {entry.value} (across {mentionCount} mentions)
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="avgHope"
                  name="Avg Hope"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="avgConcern"
                  name="Avg Concern"
                  stroke="#f43f5e"
                  fill="#f43f5e"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart 2: Coverage Distribution */}
        <div className="bg-white border border-cream-200 rounded-xl p-6">
          <h2 className="font-display text-base font-semibold text-ink-900 mb-4">
            Coverage Distribution
          </h2>
          {!hasEnoughData ? (
            <div className="flex items-center justify-center h-[256px]">
              <p className="text-sm text-ink-300 text-center">{noDataMessage}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={256}>
              <BarChart data={coverageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEECE5" />
                <XAxis dataKey="date" stroke="#E0DDD4" fontSize={11} tick={{ fill: "#9C9A92" }} />
                <YAxis stroke="#E0DDD4" fontSize={11} />
                <Tooltip contentStyle={{ fontSize: 12, border: "1px solid #EEECE5", borderRadius: 8 }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                {Object.entries(TIER_COLORS).map(([tier, color]) => (
                  <Bar key={tier} dataKey={tier} name={TIER_LABELS[tier]} stackId="a" fill={color} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart 3: Top Topics This Week */}
        <div className="bg-white border border-cream-200 rounded-xl p-6">
          <h2 className="font-display text-base font-semibold text-ink-900 mb-4">
            Top Topics This Week
          </h2>
          {topicData.length === 0 ? (
            <p className="text-sm text-ink-300 text-center py-8">No topic data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(topicData.length * 32, 120)}>
              <BarChart data={topicData} layout="vertical" margin={{ left: 140 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEECE5" horizontal={false} />
                <XAxis type="number" stroke="#E0DDD4" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#E0DDD4"
                  fontSize={13}
                  width={140}
                  tick={(props) => {
                    const { x, y, payload } = props as { x: number; y: number; payload: { value: string } };
                    const entry = topicData.find((d) => d.name === payload.value);
                    const arrow = entry?.trend === "up" ? " \u2191" : entry?.trend === "down" ? " \u2193" : " \u2192";
                    const color = entry?.trend === "up" ? "#16a34a" : entry?.trend === "down" ? "#dc2626" : "#9C9A92";
                    return (
                      <text x={x} y={y} dy={4} textAnchor="end" fontSize={13}>
                        <tspan fill="#6B6B65">{payload.value}</tspan>
                        <tspan fill={color}>{arrow}</tspan>
                      </text>
                    );
                  }}
                />
                <Tooltip contentStyle={{ fontSize: 12, border: "1px solid #EEECE5", borderRadius: 8 }} />
                <Bar dataKey="count" fill="#60a5fa" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart 4: Fire Frequency */}
        <div className="bg-white border border-cream-200 rounded-xl p-6">
          <h2 className="font-display text-base font-semibold text-ink-900 mb-4">
            Fire Frequency (30 days)
          </h2>
          {!hasFireData && !hasEnoughData ? (
            <div className="flex items-center justify-center h-[256px]">
              <p className="text-sm text-ink-300 text-center">{noDataMessage}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={256}>
              <BarChart data={fireData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEECE5" />
                <XAxis dataKey="date" stroke="#E0DDD4" fontSize={11} tick={{ fill: "#9C9A92" }} />
                <YAxis stroke="#E0DDD4" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, border: "1px solid #EEECE5", borderRadius: 8 }} />
                <ReferenceLine
                  y={avgFires}
                  stroke="#9C9A92"
                  strokeDasharray="4 4"
                  label={{ value: `avg ${avgFires}`, position: "right", fontSize: 10, fill: "#9C9A92" }}
                />
                <Bar dataKey="fires" name="Fires" fill="#f87171" radius={[2, 2, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
