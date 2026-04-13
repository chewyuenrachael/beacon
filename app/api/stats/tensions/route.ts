import { NextRequest, NextResponse } from "next/server";
import { subDays, format } from "date-fns";
import { supabaseAdmin } from "@/lib/supabase";
import type { TensionStatsResponse } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const days = parseInt(
      request.nextUrl.searchParams.get("days") || "7",
      10
    );
    const cutoff = subDays(new Date(), days).toISOString();

    const { data, error } = await supabaseAdmin
      .from("mentions")
      .select("tension_type, hope_score, concern_score, published_at")
      .gte("published_at", cutoff)
      .not("classified_at", "is", null);

    if (error) throw error;

    const mentions = data ?? [];

    // Tension type distribution
    const distribution: Record<string, number> = {};
    let totalTensionCount = 0;
    for (const m of mentions) {
      if (m.tension_type && m.tension_type !== "none") {
        distribution[m.tension_type] = (distribution[m.tension_type] || 0) + 1;
        totalTensionCount++;
      }
    }

    // Daily averages
    const dailyMap = new Map<
      string,
      { hopeSum: number; concernSum: number; count: number; tensionCount: number }
    >();

    for (const m of mentions) {
      const day = format(new Date(m.published_at), "yyyy-MM-dd");
      const entry = dailyMap.get(day) || {
        hopeSum: 0,
        concernSum: 0,
        count: 0,
        tensionCount: 0,
      };
      entry.hopeSum += m.hope_score ?? 0;
      entry.concernSum += m.concern_score ?? 0;
      entry.count++;
      if (m.tension_type && m.tension_type !== "none") {
        entry.tensionCount++;
      }
      dailyMap.set(day, entry);
    }

    const averages = Array.from(dailyMap.entries())
      .map(([date, v]) => ({
        date,
        avg_hope: v.count > 0 ? Math.round((v.hopeSum / v.count) * 100) / 100 : 0,
        avg_concern: v.count > 0 ? Math.round((v.concernSum / v.count) * 100) / 100 : 0,
        tension_count: v.tensionCount,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const response: TensionStatsResponse = {
      distribution,
      averages,
      total_tension_count: totalTensionCount,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("GET /api/stats/tensions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch tension stats" },
      { status: 500 }
    );
  }
}
