"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

const URGENCY_OPTIONS = ["fire", "moment", "signal", "noise"] as const;
const SOURCE_GROUPS: { label: string; sources: { value: string; label: string; color: string }[] }[] = [
  {
    label: "Community",
    sources: [
      { value: "hackernews", label: "Hacker News", color: "#FF6600" },
      { value: "reddit", label: "Reddit", color: "#FF4500" },
      { value: "twitter", label: "\uD835\uDD4F / Twitter", color: "#000000" },
      { value: "discord", label: "Discord", color: "#5865F2" },
    ],
  },
  {
    label: "Media & Industry",
    sources: [
      { value: "youtube", label: "YouTube", color: "#FF0000" },
      { value: "rss", label: "RSS / Press", color: "#EE802F" },
    ],
  },
];
const FLAG_OPTIONS = [
  { value: "draft_response", label: "Response needed" },
  { value: "share_with_product", label: "Share with product" },
  { value: "case_study", label: "Case study" },
  { value: "include_in_brief", label: "Include in brief" },
] as const;
const TIME_OPTIONS = [
  { value: "1h", label: "1h" },
  { value: "6h", label: "6h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
] as const;
const TOPIC_OPTIONS = [
  { value: "safety-alignment", label: "Safety & alignment" },
  { value: "developer-experience", label: "Developer experience" },
  { value: "enterprise-adoption", label: "Enterprise adoption" },
  { value: "competitive-positioning", label: "Competitive" },
  { value: "pricing-access", label: "Pricing & access" },
  { value: "open-source-ecosystem", label: "Open source & ecosystem" },
  { value: "regulation-policy", label: "Regulation & policy" },
] as const;

interface FilterStats {
  total: number;
  fires: number;
  tensions: number;
  accelerating: number;
  sourceCounts?: Record<string, number>;
  topicCounts?: Record<string, number>;
}

interface FilterSidebarProps {
  stats?: FilterStats;
}

export default function FilterSidebar({ stats }: FilterSidebarProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const updateParams = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      params.delete("offset");
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname]
  );

  const toggleMulti = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const current = params.get(key)?.split(",").filter(Boolean) || [];
      const idx = current.indexOf(value);
      if (idx >= 0) {
        current.splice(idx, 1);
      } else {
        current.push(value);
      }
      if (current.length === 0) {
        params.delete(key);
      } else {
        params.set(key, current.join(","));
      }
      params.delete("offset");
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname]
  );

  const selectedUrgencies = searchParams.get("urgency")?.split(",").filter(Boolean) || [];
  const selectedSources = searchParams.get("source")?.split(",").filter(Boolean) || [];
  const selectedTime = searchParams.get("time") || "24h";
  const selectedFlags = searchParams.get("flag")?.split(",").filter(Boolean) || [];
  const acceleratingOnly = searchParams.get("accelerating") === "true";
  const tensionsOnly = searchParams.get("tensions") === "true";
  const selectedTopics = searchParams.get("topic")?.split(",").filter(Boolean) || [];
  const bookmarkedOnly = searchParams.get("bookmarked") === "true";

  return (
    <div className="w-[200px] shrink-0 space-y-4">
      {/* Urgency */}
      <div>
        <h3 className="text-[10px] font-medium text-ink-300 uppercase tracking-widest mb-1.5">
          Urgency
        </h3>
        <div className="space-y-0.5">
          {URGENCY_OPTIONS.map((u) => (
            <label key={u} className="flex items-center gap-2 cursor-pointer py-0.5">
              <input
                type="checkbox"
                checked={selectedUrgencies.includes(u)}
                onChange={() => toggleMulti("urgency", u)}
                className="rounded border-cream-300 text-ink-900 focus:ring-ink-900 h-3.5 w-3.5"
              />
              <span className="text-xs text-ink-700 capitalize">{u}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Sources (grouped by tier) */}
      <div>
        <h3 className="text-[10px] font-medium text-ink-300 uppercase tracking-widest mb-1.5">
          Sources
        </h3>
        {SOURCE_GROUPS.map((group) => (
          <div key={group.label} className="mb-2">
            <p className="text-[10px] text-ink-300 mb-0.5">{group.label}</p>
            <div className="space-y-0.5">
              {group.sources.map((s) => (
                <label key={s.value} className="flex items-center gap-2 cursor-pointer py-0.5">
                  <input
                    type="checkbox"
                    checked={selectedSources.includes(s.value)}
                    onChange={() => toggleMulti("source", s.value)}
                    className="rounded border-cream-300 text-ink-900 focus:ring-ink-900 h-3.5 w-3.5"
                  />
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-xs text-ink-700">{s.label}</span>
                  {stats?.sourceCounts && (
                    <span className="text-[10px] text-ink-300 ml-auto">
                      {stats.sourceCounts[s.value] || 0}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Topics */}
      <div>
        <h3 className="text-[10px] font-medium text-ink-300 uppercase tracking-widest mb-1.5">
          Topics
        </h3>
        <div className="space-y-0.5">
          {TOPIC_OPTIONS.map((t) => (
            <label key={t.value} className="flex items-center gap-2 cursor-pointer py-0.5">
              <input
                type="checkbox"
                checked={selectedTopics.includes(t.value)}
                onChange={() => toggleMulti("topic", t.value)}
                className="rounded border-cream-300 text-ink-900 focus:ring-ink-900 h-3.5 w-3.5"
              />
              <span className="text-xs text-ink-700">{t.label}</span>
              {stats?.topicCounts && (
                <span className="text-[10px] text-ink-300 ml-auto">
                  {stats.topicCounts[t.value] || 0}
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Flags */}
      <div>
        <h3 className="text-[10px] font-medium text-ink-300 uppercase tracking-widest mb-1.5">
          Flags
        </h3>
        <div className="space-y-0.5">
          {FLAG_OPTIONS.map((f) => (
            <label key={f.value} className="flex items-center gap-2 cursor-pointer py-0.5">
              <input
                type="checkbox"
                checked={selectedFlags.includes(f.value)}
                onChange={() => toggleMulti("flag", f.value)}
                className="rounded border-cream-300 text-ink-900 focus:ring-ink-900 h-3.5 w-3.5"
              />
              <span className="text-xs text-ink-700">{f.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Time range */}
      <div>
        <h3 className="text-[10px] font-medium text-ink-300 uppercase tracking-widest mb-1.5">
          Time Range
        </h3>
        <div className="flex flex-wrap gap-1">
          {TIME_OPTIONS.map((t) => (
            <button
              key={t.value}
              onClick={() => updateParams("time", t.value)}
              className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                selectedTime === t.value
                  ? "bg-ink-900 text-white border-ink-900"
                  : "bg-white text-ink-500 border-cream-200 hover:border-cream-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-1">
        <label className="flex items-center gap-2 cursor-pointer py-0.5">
          <input
            type="checkbox"
            checked={acceleratingOnly}
            onChange={() =>
              updateParams("accelerating", acceleratingOnly ? null : "true")
            }
            className="rounded border-cream-300 text-ink-900 focus:ring-ink-900 h-3.5 w-3.5"
          />
          <span className="text-xs text-ink-700">Accelerating only</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer py-0.5">
          <input
            type="checkbox"
            checked={tensionsOnly}
            onChange={() =>
              updateParams("tensions", tensionsOnly ? null : "true")
            }
            className="rounded border-cream-300 text-ink-900 focus:ring-ink-900 h-3.5 w-3.5"
          />
          <span className="text-xs text-ink-700">Tensions only</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer py-0.5">
          <input
            type="checkbox"
            checked={bookmarkedOnly}
            onChange={() =>
              updateParams("bookmarked", bookmarkedOnly ? null : "true")
            }
            className="rounded border-cream-300 text-ink-900 focus:ring-ink-900 h-3.5 w-3.5"
          />
          <span className="text-xs text-ink-700">Bookmarked only</span>
        </label>
      </div>

      {/* Stats */}
      {stats && (
        <div className="pt-3 border-t border-cream-200 space-y-1">
          <p className="text-xs text-ink-300">
            <span className="font-medium text-ink-700">{stats.total}</span> mentions
          </p>
          <p className="text-xs text-ink-300">
            <span className="font-medium text-red-600">{stats.fires}</span> fires
          </p>
          <p className="text-xs text-ink-300">
            <span className="font-medium text-purple-600">{stats.tensions}</span> tensions
          </p>
          <p className="text-xs text-ink-300">
            <span className="font-medium text-orange-600">{stats.accelerating}</span> accelerating
          </p>
          {stats.sourceCounts && (
            <p className="text-xs text-ink-300 pt-1">
              {SOURCE_GROUPS.flatMap((g) => g.sources)
                .filter((s) => (stats.sourceCounts![s.value] || 0) > 0)
                .map((s) => `${stats.sourceCounts![s.value]} ${s.label}`)
                .join(" \u00B7 ")}
            </p>
          )}
          {stats.topicCounts && (() => {
            const top = TOPIC_OPTIONS
              .filter((t) => (stats.topicCounts![t.value] || 0) > 0)
              .sort((a, b) => stats.topicCounts![b.value] - stats.topicCounts![a.value])
              .slice(0, 3);
            return top.length > 0 ? (
              <p className="text-[10px] text-ink-400 pt-1">
                Top: {top.map((t) => `${t.label} (${stats.topicCounts![t.value]})`).join(" \u00B7 ")}
              </p>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}
