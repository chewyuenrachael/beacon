import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const scenario_type = params.get("scenario_type");
    const channel = params.get("channel");

    let query = supabaseAdmin
      .from("response_templates")
      .select("*")
      .eq("is_active", true)
      .order("usage_count", { ascending: false });

    if (scenario_type) query = query.eq("scenario_type", scenario_type);
    if (channel) query = query.eq("channel", channel);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("GET /api/templates error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch templates",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { scenario_type, title, channel, template_body, placeholders } = body;

    if (!scenario_type || !title || !channel || !template_body) {
      return NextResponse.json(
        {
          error:
            "scenario_type, title, channel, and template_body are required",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("response_templates")
      .insert({
        scenario_type,
        title,
        channel,
        template_body,
        placeholders: placeholders || [],
        is_active: true,
        usage_count: 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/templates error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create template",
      },
      { status: 500 }
    );
  }
}
