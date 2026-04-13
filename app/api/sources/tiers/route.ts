import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("source_tiers")
      .select("*")
      .order("tier")
      .order("source");

    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("GET /api/sources/tiers error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch tiers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.source || !body.display_name || body.tier === undefined) {
      return NextResponse.json(
        { error: "source, tier, and display_name are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("source_tiers")
      .insert({
        source: body.source,
        tier: body.tier,
        display_name: body.display_name,
        icon: body.icon || null,
        color: body.color || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/sources/tiers error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create tier" },
      { status: 500 }
    );
  }
}
