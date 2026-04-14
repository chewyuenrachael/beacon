import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { LLMPlatform } from "@/lib/types";

const ALL_PLATFORMS: LLMPlatform[] = [
  "chatgpt", "gemini", "perplexity", "copilot", "meta-ai", "claude",
];

function getPreviousWeek(): { start: string; end: string } {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(now);
  thisMonday.setUTCDate(now.getUTCDate() - daysToLastMonday);
  thisMonday.setUTCHours(0, 0, 0, 0);

  const lastMonday = new Date(thisMonday);
  lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);

  const lastSunday = new Date(thisMonday);
  lastSunday.setUTCDate(thisMonday.getUTCDate() - 1);
  lastSunday.setUTCHours(23, 59, 59, 999);

  return {
    start: lastMonday.toISOString().split("T")[0],
    end: lastSunday.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const platform = params.get("platform");
    const weeks = parseInt(params.get("weeks") || "12", 10);
    const weekStart = params.get("week_start");

    let query = supabaseAdmin
      .from("llm_monitoring_snapshots")
      .select("*")
      .order("week_start", { ascending: false });

    if (weekStart) {
      // Specific week, all platforms
      query = query.eq("week_start", weekStart);
    } else if (platform) {
      // Per-platform trend
      query = query.eq("platform", platform).limit(weeks);
    } else {
      // Default: latest week for all platforms
      // First get the most recent week_start
      const { data: latest } = await supabaseAdmin
        .from("llm_monitoring_snapshots")
        .select("week_start")
        .order("week_start", { ascending: false })
        .limit(1)
        .single();

      if (!latest) {
        return NextResponse.json([]);
      }

      query = query.eq("week_start", latest.week_start);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Map DB column names to dashboard LLMMonitoringSnapshot shape
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformed = (data || []).map((s: any) => ({
      id: s.id,
      platform: s.platform,
      week_start: s.week_start,
      mention_rate: Number(s.anthropic_mention_rate) || 0,
      avg_sentiment: Number(s.avg_sentiment) || 0,
      avg_rank: s.avg_rank != null ? Number(s.avg_rank) : null,
      error_count: Number(s.error_count) || 0,
      response_count: Number(s.total_responses) || Number(s.total_probes) || 0,
    }));

    return NextResponse.json(transformed);
  } catch (error) {
    console.error("GET /api/llm-monitor/snapshots error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch snapshots" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const { start: weekStart, end: weekEnd } = getPreviousWeek();

    // Fetch all responses for the week
    const { data: responses, error: respError } = await supabaseAdmin
      .from("llm_responses")
      .select("id, probe_id, platform")
      .gte("response_date", weekStart)
      .lte("response_date", weekEnd);

    if (respError) throw respError;
    if (!responses || responses.length === 0) {
      return NextResponse.json({ generated: 0, week_start: weekStart, message: "No responses for this week" });
    }

    // Fetch classifications for those responses
    const responseIds = responses.map((r) => r.id);
    const { data: classifications } = await supabaseAdmin
      .from("llm_response_classifications")
      .select("*")
      .in("response_id", responseIds);

    const classificationMap = new Map(
      (classifications || []).map((c) => [c.response_id, c])
    );

    // Group responses by platform
    const byPlatform = new Map<string, typeof responses>();
    for (const r of responses) {
      const list = byPlatform.get(r.platform) || [];
      list.push(r);
      byPlatform.set(r.platform, list);
    }

    let generated = 0;

    for (const platform of ALL_PLATFORMS) {
      const platformResponses = byPlatform.get(platform);
      if (!platformResponses || platformResponses.length === 0) continue;

      const classified = platformResponses
        .map((r) => classificationMap.get(r.id))
        .filter(Boolean);

      const total = classified.length;
      if (total === 0) continue;

      // Anthropic mention rate
      const mentioned = classified.filter((c) => c.anthropic_mentioned);
      const mentionRate = mentioned.length / total;

      // Avg sentiment (where mentioned)
      const sentiments = mentioned
        .map((c) => c.mention_sentiment)
        .filter((s): s is number => s != null);
      const avgSentiment = sentiments.length > 0
        ? sentiments.reduce((a: number, b: number) => a + b, 0) / sentiments.length
        : 0;

      // Avg rank (where ranked)
      const ranks = classified
        .map((c) => c.anthropic_rank)
        .filter((r): r is number => r != null);
      const avgRank = ranks.length > 0
        ? ranks.reduce((a: number, b: number) => a + b, 0) / ranks.length
        : null;

      // Narrative pull-through
      const narrativeCounts: Record<string, { present: number; total: number }> = {};
      for (const c of classified) {
        const narratives = c.narratives_reflected;
        if (Array.isArray(narratives)) {
          for (const n of narratives) {
            if (!narrativeCounts[n.slug]) {
              narrativeCounts[n.slug] = { present: 0, total: 0 };
            }
            narrativeCounts[n.slug].total++;
            if (n.present) narrativeCounts[n.slug].present++;
          }
        }
      }
      const narrativePullThrough: Record<string, number> = {};
      for (const [slug, counts] of Object.entries(narrativeCounts)) {
        narrativePullThrough[slug] = counts.total > 0
          ? Math.round((counts.present / counts.total) * 100) / 100
          : 0;
      }

      // Top competitor (most frequently favored)
      const competitorCounts: Record<string, number> = {};
      for (const c of classified) {
        const favored = c.competitors_favored;
        if (Array.isArray(favored)) {
          for (const name of favored) {
            competitorCounts[name] = (competitorCounts[name] || 0) + 1;
          }
        }
      }
      const topCompetitor = Object.entries(competitorCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      // Error counts
      const errorCount = classified.filter((c) => {
        const errors = c.factual_errors;
        return Array.isArray(errors) && errors.length > 0;
      }).length;
      const criticalErrorCount = classified.filter((c) => c.has_critical_error).length;

      // Distinct probes
      const distinctProbes = new Set(platformResponses.map((r) => r.probe_id)).size;

      const { error } = await supabaseAdmin
        .from("llm_monitoring_snapshots")
        .upsert(
          {
            week_start: weekStart,
            platform,
            total_probes: distinctProbes,
            anthropic_mention_rate: Math.round(mentionRate * 100) / 100,
            avg_sentiment: Math.round(avgSentiment * 100) / 100,
            avg_rank: avgRank != null ? Math.round(avgRank * 100) / 100 : null,
            narrative_pull_through: narrativePullThrough,
            top_competitor: topCompetitor,
            error_count: errorCount,
            critical_error_count: criticalErrorCount,
            snapshot_at: new Date().toISOString(),
          },
          { onConflict: "platform,week_start" }
        );

      if (!error) generated++;
    }

    return NextResponse.json({ generated, week_start: weekStart });
  } catch (error) {
    console.error("POST /api/llm-monitor/snapshots error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Snapshot generation failed" },
      { status: 500 }
    );
  }
}
