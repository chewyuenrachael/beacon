import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { transformResponse } from "../_transform";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const platform = params.get("platform");
    const category = params.get("category");
    const date = params.get("date");
    const dateFrom = params.get("date_from");
    const dateTo = params.get("date_to");
    const hasErrors = params.get("has_errors") === "true";
    const unclassified = params.get("unclassified") === "true";
    const page = Math.max(parseInt(params.get("page") || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(params.get("limit") || "20", 10), 1), 200);
    const offset = (page - 1) * limit;

    // Pre-fetch filters that require separate queries
    let probeIds: string[] | null = null;
    if (category) {
      const { data: probes } = await supabaseAdmin
        .from("llm_probes")
        .select("id")
        .eq("category", category);
      probeIds = (probes || []).map((p) => p.id);
      if (probeIds.length === 0) {
        return NextResponse.json({ data: [], count: 0, page, limit });
      }
    }

    let errorResponseIds: string[] | null = null;
    if (hasErrors) {
      const { data: errorClassifications } = await supabaseAdmin
        .from("llm_response_classifications")
        .select("response_id")
        .eq("has_critical_error", true);
      errorResponseIds = (errorClassifications || []).map((c) => c.response_id);
      if (errorResponseIds.length === 0) {
        return NextResponse.json({ data: [], count: 0, page, limit });
      }
    }

    let classifiedIds: string[] | null = null;
    if (unclassified) {
      const { data: classified } = await supabaseAdmin
        .from("llm_response_classifications")
        .select("response_id");
      classifiedIds = (classified || []).map((c) => c.response_id);
    }

    // Build main query with relations
    let query = supabaseAdmin
      .from("llm_responses")
      .select(
        "*, probe:llm_probes(*), classification:llm_response_classifications(*)",
        { count: "exact" }
      );

    if (platform) {
      query = query.eq("platform", platform);
    }
    if (probeIds) {
      query = query.in("probe_id", probeIds);
    }
    if (date) {
      query = query.eq("response_date", date);
    }
    if (dateFrom) {
      query = query.gte("response_date", dateFrom);
    }
    if (dateTo) {
      query = query.lte("response_date", dateTo);
    }
    if (errorResponseIds) {
      query = query.in("id", errorResponseIds);
    }
    if (classifiedIds) {
      if (classifiedIds.length > 0) {
        query = query.not("id", "in", `(${classifiedIds.join(",")})`);
      }
      // If no classified responses exist, all responses are unclassified — no filter needed
    }

    query = query
      .order("response_date", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      data: (data ?? []).map(transformResponse),
      count: count ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("GET /api/llm-monitor/responses error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch responses" },
      { status: 500 }
    );
  }
}
