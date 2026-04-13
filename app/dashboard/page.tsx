"use client";

import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { MentionRow } from "@/lib/types";
import MentionCard from "@/components/MentionCard";
import FilterSidebar from "@/components/FilterSidebar";
import { PageLoadingSkeleton, SkeletonCard } from "@/components/LoadingSkeleton";
import PropagationTimeline, { type PropagationCluster } from "@/components/PropagationTimeline";

async function detectBestTimeRange(): Promise<string> {
  const ranges = ["24h", "7d", "30d"];
  for (const range of ranges) {
    try {
      const res = await fetch(`/api/mentions?time_range=${range}&limit=1`);
      const data = await res.json();
      if (data.count > 0 || (data.data && data.data.length > 0)) {
        return range;
      }
    } catch {
      // continue to next range
    }
  }
  return "7d";
}

const PAGE_SIZE = 20;

const STATUS_STYLES: Record<string, string> = {
  active: "bg-red-50 text-red-700",
  slowing: "bg-amber-50 text-amber-700",
};

const PLATFORM_META: Record<string, { color: string; label: string }> = {
  hackernews: { color: "#FF6600", label: "HN" },
  reddit: { color: "#FF4500", label: "Reddit" },
  twitter: { color: "#000000", label: "\uD835\uDD4F" },
  discord: { color: "#5865F2", label: "Discord" },
  youtube: { color: "#FF0000", label: "YouTube" },
  rss: { color: "#EE802F", label: "RSS" },
};

function DashboardFeed() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [allMentions, setAllMentions] = useState<MentionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clusters, setClusters] = useState<PropagationCluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<PropagationCluster | null>(null);
  const [detecting, setDetecting] = useState(!searchParams.get("time"));

  const selectedSources = searchParams.get("source")?.split(",").filter(Boolean) || [];
  const selectedFlags = searchParams.get("flag")?.split(",").filter(Boolean) || [];
  const selectedTopics = searchParams.get("topic")?.split(",").filter(Boolean) || [];
  const bookmarkedOnly = searchParams.get("bookmarked") === "true";
  const tensionsOnly = searchParams.get("tensions") === "true";

  const fetchMentions = useCallback(
    async () => {
      setAllMentions([]);
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();

        const urgency = searchParams.get("urgency");
        if (urgency) params.set("urgency", urgency);

        const time = searchParams.get("time");
        if (time) params.set("time_range", time);
        else params.set("time_range", "7d");

        const accelerating = searchParams.get("accelerating");
        if (accelerating === "true") params.set("velocity_status", "accelerating");

        params.set("limit", "500");
        params.set("offset", "0");

        const res = await fetch(`/api/mentions?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch mentions");

        const json = await res.json();
        const data: MentionRow[] = json.data || json;
        if (Array.isArray(data)) {
          setAllMentions(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [searchParams]
  );

  // Page title
  useEffect(() => {
    document.title = "Feed \u2014 Beacon";
  }, []);

  // Smart time range detection on first load
  useEffect(() => {
    if (searchParams.get("time")) {
      setDetecting(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const range = await detectBestTimeRange();
      if (!cancelled) {
        // Guard against race: user may have clicked a time pill during detection
        const currentParams = new URLSearchParams(window.location.search);
        if (!currentParams.get("time")) {
          currentParams.set("time", range);
          router.replace(`${pathname}?${currentParams.toString()}`);
        }
        setDetecting(false);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (detecting) return;
    const interval = setInterval(fetchMentions, 60_000);
    return () => clearInterval(interval);
  }, [fetchMentions, detecting]);

  useEffect(() => {
    if (!detecting) fetchMentions();
  }, [fetchMentions, detecting]);

  // Fetch propagation clusters via API (non-critical — fails silently)
  useEffect(() => {
    async function fetchClusters() {
      try {
        const res = await fetch("/api/sources/propagation?include_mentions=true");
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          setClusters(data.filter((c: PropagationCluster) => c.status !== "resolved"));
        }
      } catch {
        // non-critical — propagation section simply won't render
      }
    }
    fetchClusters();
  }, []);

  // Build mention → cluster map for propagation badges
  const mentionClusterMap = useMemo(() => {
    const map = new Map<string, { cluster_id: string; cluster_title: string; platforms_reached: string[] }>();
    for (const c of clusters) {
      const ids: string[] = c.mention_ids || [];
      for (const id of ids) {
        map.set(id, {
          cluster_id: c.id,
          cluster_title: c.cluster_title,
          platforms_reached: c.platforms_reached,
        });
      }
    }
    return map;
  }, [clusters]);

  // Client-side filtering: sources, flags, bookmarks, tensions
  const filteredMentions = useMemo(() => {
    let result = allMentions;
    if (selectedSources.length > 0) {
      result = result.filter((m) => selectedSources.includes(m.source));
    }
    if (selectedFlags.length > 0) {
      result = result.filter((m) => m.flag_type && selectedFlags.includes(m.flag_type));
    }
    if (selectedTopics.length > 0) {
      result = result.filter((m) =>
        m.topics && m.topics.some((t) => selectedTopics.includes(t))
      );
    }
    if (bookmarkedOnly) {
      result = result.filter((m) => m.is_bookmarked);
    }
    if (tensionsOnly) {
      result = result.filter((m) => m.tension_type && m.tension_type !== "none");
    }
    return result.slice().sort((a, b) => {
      if (a.urgency === "fire" && b.urgency !== "fire") return -1;
      if (b.urgency === "fire" && a.urgency !== "fire") return 1;
      return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    });
  }, [allMentions, selectedSources, selectedFlags, selectedTopics, bookmarkedOnly, tensionsOnly]);

  // Paginate filtered results
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const searchParamsKey = searchParams.toString();
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchParamsKey]);

  const visibleMentions = filteredMentions.slice(0, visibleCount);
  const hasMore = visibleCount < filteredMentions.length;

  // Compute stats from full unfiltered data
  const stats = useMemo(() => {
    if (!allMentions.length) {
      return { total: 0, fires: 0, tensions: 0, accelerating: 0, sourceCounts: undefined, topicCounts: undefined };
    }
    const sourceCounts: Record<string, number> = {};
    const topicCounts: Record<string, number> = {};
    for (const m of allMentions) {
      const src = m.source;
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
      if (m.topics) {
        for (const t of m.topics) {
          topicCounts[t] = (topicCounts[t] || 0) + 1;
        }
      }
    }
    return {
      total: allMentions.length,
      fires: allMentions.filter((m) => m.urgency === "fire").length,
      tensions: allMentions.filter((m) => m.tension_type && m.tension_type !== "none").length,
      accelerating: allMentions.filter((m) => m.velocity_status === "accelerating").length,
      sourceCounts,
      topicCounts,
    };
  }, [allMentions]);

  return (
    <div className="max-w-4xl mx-auto flex gap-6">
      <FilterSidebar stats={stats} />
      <div className="flex-1 min-w-0 space-y-3">
        <h1 className="font-display text-lg font-semibold text-ink-900 mb-4">Feed</h1>

        {/* Spreading Now — active propagation clusters */}
        {clusters.length > 0 && (
          <div className="mb-4">
            <h2 className="text-[10px] font-medium text-ink-300 uppercase tracking-widest mb-2">
              {"\uD83C\uDF0A"} Spreading Now
            </h2>
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
              {clusters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCluster(c)}
                  className="bg-white border border-blue-200 rounded-lg p-3 text-left hover:bg-blue-50/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded ${
                      STATUS_STYLES[c.status] || "bg-cream-100 text-ink-500"
                    }`}>
                      {c.status}
                    </span>
                    <span className="text-[10px] text-ink-300">
                      {c.platforms_reached.length} platforms
                    </span>
                  </div>
                  <p className="text-sm font-medium text-ink-900 line-clamp-1">{c.cluster_title}</p>
                  <div className="flex gap-1.5 mt-1">
                    {c.platforms_reached.map((p) => (
                      <span key={p} className="flex items-center gap-0.5 text-[10px] text-ink-400">
                        <span
                          className="w-1.5 h-1.5 rounded-full inline-block"
                          style={{ backgroundColor: PLATFORM_META[p]?.color || "#6B6B65" }}
                        />
                        {PLATFORM_META[p]?.label || p}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={fetchMentions}
              className="text-xs text-red-600 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {detecting || loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} height={100} />
            ))}
          </div>
        ) : filteredMentions.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-ink-300">
              {allMentions.length === 0
                ? "No mentions found for this time range. Try expanding the time range or run an ingestion from Settings."
                : "No mentions match the selected filters."}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {visibleMentions.map((m) => (
                <MentionCard
                  key={m.id}
                  mention={m}
                  propagation={mentionClusterMap.get(m.id) || null}
                  onPropagationClick={(clusterId) => {
                    const c = clusters.find((cl) => cl.id === clusterId);
                    if (c) setSelectedCluster(c);
                  }}
                />
              ))}
            </div>
            {hasMore && (
              <div className="py-4 text-center">
                <button
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="text-sm text-ink-500 hover:text-ink-900 border border-cream-200 rounded-md px-4 py-2 hover:border-cream-300 transition-colors"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Propagation Timeline slide-over */}
      {selectedCluster && (
        <PropagationTimeline
          cluster={selectedCluster}
          onClose={() => setSelectedCluster(null)}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto flex gap-6">
          <div className="w-[200px] shrink-0" />
          <div className="flex-1 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} height={100} />
            ))}
          </div>
        </div>
      }
    >
      <DashboardFeed />
    </Suspense>
  );
}
