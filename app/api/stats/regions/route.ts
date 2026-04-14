import { NextRequest, NextResponse } from "next/server";
import { subDays } from "date-fns";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { RegionStatsResponse } from "@/lib/types";

async function generateNarrative(
  region: string,
  data: {
    mentionCount: number;
    fireCount: number;
    netSentiment: number;
    topTopics: string[];
    topEmotions: string[];
  }
): Promise<string> {
  const regionName = region.replace(/-/g, " ");
  const sentimentLabel = data.netSentiment > 0 ? "positive" : "negative";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: `Write a single sentence (max 25 words) summarizing the developer sentiment in ${regionName} about Claude/Anthropic based on this data:
- ${data.mentionCount} mentions, ${data.fireCount} fires
- Top topics: ${data.topTopics.join(", ") || "general"}
- Net sentiment: ${sentimentLabel}
- Top emotions: ${data.topEmotions.join(", ") || "mixed"}

Write from the perspective of briefing a communications team. Be specific about what the region cares about. Example: "North America focused on security concerns after DoD allegations, but developer builds remain strong."`,
        },
      ],
    }),
  });

  const result = await response.json();
  return result.content?.[0]?.text?.trim() ?? "";
}

export async function GET(request: NextRequest) {
  try {
    const days = parseInt(
      request.nextUrl.searchParams.get("days") || "30",
      10
    );
    const cutoff = subDays(new Date(), days).toISOString();

    const { data, error } = await supabaseAdmin
      .from("mentions")
      .select(
        "inferred_region, hope_score, concern_score, urgency, tension_type, topics, summary, source_url, primary_emotion"
      )
      .gte("published_at", cutoff)
      .not("inferred_region", "is", null)
      .not("classified_at", "is", null);

    if (error) throw error;

    const mentions = data ?? [];

    // Aggregate by region
    const regionMap = new Map<
      string,
      {
        hopeSum: number;
        concernSum: number;
        count: number;
        fireCount: number;
        momentCount: number;
        tensionCounts: Record<string, number>;
        topicCounts: Record<string, number>;
        emotionCounts: Record<string, number>;
        urgencyCounts: Record<string, number>;
        fires: { summary: string; source_url: string }[];
        moments: { summary: string; source_url: string }[];
      }
    >();

    for (const m of mentions) {
      const region = m.inferred_region as string;
      const entry = regionMap.get(region) || {
        hopeSum: 0,
        concernSum: 0,
        count: 0,
        fireCount: 0,
        momentCount: 0,
        tensionCounts: {},
        topicCounts: {},
        emotionCounts: {},
        urgencyCounts: {},
        fires: [],
        moments: [],
      };

      entry.hopeSum += m.hope_score ?? 0;
      entry.concernSum += m.concern_score ?? 0;
      entry.count++;

      if (m.urgency) {
        entry.urgencyCounts[m.urgency] =
          (entry.urgencyCounts[m.urgency] || 0) + 1;

        if (m.urgency === "fire") {
          entry.fireCount++;
          if (m.summary) {
            entry.fires.push({
              summary: m.summary,
              source_url: m.source_url,
            });
          }
        }
        if (m.urgency === "moment") {
          entry.momentCount++;
          if (m.summary) {
            entry.moments.push({
              summary: m.summary,
              source_url: m.source_url,
            });
          }
        }
      }

      if (m.primary_emotion) {
        entry.emotionCounts[m.primary_emotion] =
          (entry.emotionCounts[m.primary_emotion] || 0) + 1;
      }

      if (m.tension_type && m.tension_type !== "none") {
        entry.tensionCounts[m.tension_type] =
          (entry.tensionCounts[m.tension_type] || 0) + 1;
      }

      if (m.topics) {
        for (const t of m.topics as string[]) {
          entry.topicCounts[t] = (entry.topicCounts[t] || 0) + 1;
        }
      }

      regionMap.set(region, entry);
    }

    const regions = Array.from(regionMap.entries())
      .map(([region, v]) => {
        const topTension =
          Object.entries(v.tensionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
          "none";

        const topTopics = Object.entries(v.topicCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([t]) => t);

        const topEmotions = Object.entries(v.emotionCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([e]) => e);

        const dominantUrgency =
          Object.entries(v.urgencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
          "noise";

        const avgHope =
          v.count > 0
            ? Math.round((v.hopeSum / v.count) * 100) / 100
            : 0;
        const avgConcern =
          v.count > 0
            ? Math.round((v.concernSum / v.count) * 100) / 100
            : 0;
        const netSentiment = Math.round((avgHope - avgConcern) * 100) / 100;

        return {
          region,
          mention_count: v.count,
          avg_hope: avgHope,
          avg_concern: avgConcern,
          fire_count: v.fireCount,
          moment_count: v.momentCount,
          net_sentiment: netSentiment,
          top_tension: topTension,
          top_topics: topTopics,
          top_emotions: topEmotions,
          dominant_urgency: dominantUrgency,
          fires: v.fires,
          recent_moments: v.moments,
          narrative: null as string | null,
        };
      })
      .sort((a, b) => b.mention_count - a.mention_count);

    // Generate narratives for regions with 3+ mentions
    await Promise.all(
      regions.map(async (r) => {
        if (r.mention_count >= 3) {
          try {
            r.narrative = await generateNarrative(r.region, {
              mentionCount: r.mention_count,
              fireCount: r.fire_count,
              netSentiment: r.net_sentiment,
              topTopics: r.top_topics,
              topEmotions: r.top_emotions,
            });
          } catch (err) {
            console.error(`Narrative generation failed for ${r.region}:`, err);
          }
        }
      })
    );

    const response: RegionStatsResponse = { regions };
    return NextResponse.json(response);
  } catch (error) {
    console.error("GET /api/stats/regions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch region stats" },
      { status: 500 }
    );
  }
}
