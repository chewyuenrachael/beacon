import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { ProbeCategory } from "@/lib/types";

const VALID_CATEGORIES: ProbeCategory[] = [
  "product-comparison",
  "safety-perception",
  "brand-reputation",
  "technical-capability",
  "pricing",
  "competitor-positioning",
  "factual-accuracy",
];

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const activeOnly = params.get("active_only") !== "false";
    const category = params.get("category");

    let query = supabaseAdmin
      .from("llm_probes")
      .select("*")
      .order("created_at", { ascending: false });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }
    if (category) {
      query = query.eq("category", category);
    }

    const { data: probes, error } = await query;
    if (error) throw error;

    // Enrich with last_response_date
    const probeIds = (probes || []).map((p) => p.id);
    let lastDates: Record<string, string> = {};

    if (probeIds.length > 0) {
      const { data: responses } = await supabaseAdmin
        .from("llm_responses")
        .select("probe_id, response_date")
        .in("probe_id", probeIds)
        .order("response_date", { ascending: false });

      for (const r of responses || []) {
        if (!lastDates[r.probe_id] || r.response_date > lastDates[r.probe_id]) {
          lastDates[r.probe_id] = r.response_date;
        }
      }
    }

    const enriched = (probes || []).map((p) => ({
      ...p,
      last_response_date: lastDates[p.id] || null,
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("GET /api/llm-monitor/probes error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch probes" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.prompt_text || typeof body.prompt_text !== "string") {
      return NextResponse.json(
        { error: "prompt_text is required" },
        { status: 400 }
      );
    }
    if (!body.category || !VALID_CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("llm_probes")
      .insert({
        prompt_text: body.prompt_text,
        category: body.category,
        target_entity: body.target_entity || "anthropic",
        frequency: body.frequency || "daily",
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/llm-monitor/probes error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create probe" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    if (body.category && !VALID_CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }

    const allowed = ["prompt_text", "category", "is_active", "frequency", "target_entity"];
    const updatePayload: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        updatePayload[key] = body[key];
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("llm_probes")
      .update(updatePayload)
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Probe not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("PUT /api/llm-monitor/probes error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update probe" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("llm_probes")
      .update({ is_active: false })
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Probe not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("DELETE /api/llm-monitor/probes error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete probe" },
      { status: 500 }
    );
  }
}
