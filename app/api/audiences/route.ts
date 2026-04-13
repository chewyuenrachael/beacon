import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("audiences")
      .select("*")
      .order("display_name");

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/audiences error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch audiences" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { slug, ...updates } = body;

    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    const allowed = ["slack_webhook_url", "slack_channel_name", "is_active", "brief_schedule"];
    const filtered: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in updates) filtered[key] = updates[key];
    }

    if (Object.keys(filtered).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    filtered.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("audiences")
      .update(filtered)
      .eq("slug", slug)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Audience not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("PUT /api/audiences error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update audience" },
      { status: 500 }
    );
  }
}
