import { NextRequest, NextResponse } from "next/server";
import { subHours, subDays } from "date-fns";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const urgency = params.get("urgency");
    const source = params.get("source");
    const velocity_status = params.get("velocity_status");
    const tension_type = params.get("tension_type");
    const inferred_region = params.get("inferred_region");
    const time_range = params.get("time_range") || "24h";
    const limit = Math.min(parseInt(params.get("limit") || "50", 10), 1000);
    const offset = parseInt(params.get("offset") || "0", 10);

    let query = supabaseAdmin
      .from("mentions")
      .select("*", { count: "exact" })
      .not("classified_at", "is", null);

    if (urgency) {
      const values = urgency.split(",").filter(Boolean);
      query = query.in("urgency", values);
    }
    if (source) query = query.eq("source", source);
    if (velocity_status) query = query.eq("velocity_status", velocity_status);
    if (tension_type) query = query.eq("tension_type", tension_type);
    if (inferred_region) query = query.eq("inferred_region", inferred_region);

    if (time_range && time_range !== "all") {
      const now = new Date();
      let cutoff: Date;
      switch (time_range) {
        case "1h":
          cutoff = subHours(now, 1);
          break;
        case "6h":
          cutoff = subHours(now, 6);
          break;
        case "24h":
          cutoff = subHours(now, 24);
          break;
        case "7d":
          cutoff = subDays(now, 7);
          break;
        case "30d":
          cutoff = subDays(now, 30);
          break;
        default:
          cutoff = subHours(now, 24);
      }
      query = query.gte("published_at", cutoff.toISOString());
    }

    query = query
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      data: data ?? [],
      count: count ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("GET /api/mentions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch mentions" },
      { status: 500 }
    );
  }
}
