import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();

    const base = () =>
      supabaseAdmin
        .from("mentions")
        .select("*", { count: "exact", head: true })
        .not("classified_at", "is", null)
        .gte("published_at", twentyFourHoursAgo);

    const [mentionsRes, firesRes, tensionsRes, momentsRes, topicRes] =
      await Promise.all([
        base(),
        base().eq("urgency", "fire"),
        base().not("tension_type", "is", null).neq("tension_type", "none"),
        base().eq("urgency", "moment"),
        supabaseAdmin
          .from("mentions")
          .select("topic")
          .not("classified_at", "is", null)
          .not("topic", "is", null)
          .gte("published_at", twentyFourHoursAgo),
      ]);

    // Compute top 3 narrative themes
    const topicCounts: Record<string, number> = {};
    for (const row of topicRes.data ?? []) {
      if (row.topic) {
        topicCounts[row.topic] = (topicCounts[row.topic] || 0) + 1;
      }
    }
    const topTopics = Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([theme, count]) => ({ theme, count }));

    return NextResponse.json({
      mentions: mentionsRes.count ?? 0,
      fires: firesRes.count ?? 0,
      tensions: tensionsRes.count ?? 0,
      moments: momentsRes.count ?? 0,
      topTopics,
    });
  } catch (error) {
    console.error("GET /api/brief/stats error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch stats",
      },
      { status: 500 }
    );
  }
}
