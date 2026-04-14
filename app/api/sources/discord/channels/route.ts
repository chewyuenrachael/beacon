import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const VALID_CATEGORIES = [
  "anthropic-official",
  "competitor",
  "developer-community",
  "ai-research",
  "general",
];

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const activeOnly = params.get("active_only") !== "false";

    let query = supabaseAdmin
      .from("discord_monitored_channels")
      .select("*")
      .order("server_name")
      .order("channel_name");

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data: channels, error } = await query;
    if (error) throw error;

    // Group by server_name
    const serverMap: Record<string, typeof channels> = {};
    for (const ch of channels || []) {
      if (!serverMap[ch.server_name]) serverMap[ch.server_name] = [];
      serverMap[ch.server_name].push(ch);
    }

    const servers = Object.entries(serverMap).map(([name, channels]) => ({
      name,
      channels,
    }));

    return NextResponse.json({ servers });
  } catch (error) {
    console.error("GET /api/sources/discord/channels error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch channels" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.server_name || !body.server_id || !body.channel_name || !body.channel_id) {
      return NextResponse.json(
        { error: "server_name, server_id, channel_name, and channel_id are required" },
        { status: 400 }
      );
    }

    if (body.server_id === "CONFIGURE_ME" || body.channel_id === "CONFIGURE_ME") {
      return NextResponse.json(
        { error: "server_id and channel_id must be configured with real Discord IDs, not placeholder values" },
        { status: 400 }
      );
    }

    if (body.category && !VALID_CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("discord_monitored_channels")
      .insert({
        server_name: body.server_name,
        server_id: body.server_id,
        channel_name: body.channel_name,
        channel_id: body.channel_id,
        category: body.category || "general",
        notes: body.notes || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/sources/discord/channels error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create channel" },
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

    if (body.server_id === "CONFIGURE_ME" || body.channel_id === "CONFIGURE_ME") {
      return NextResponse.json(
        { error: "server_id and channel_id must be configured with real Discord IDs, not placeholder values" },
        { status: 400 }
      );
    }

    if (body.category && !VALID_CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }

    const allowed = ["server_name", "server_id", "channel_name", "channel_id", "category", "is_active", "notes"];
    const filtered: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        filtered[key] = body[key];
      }
    }

    if (Object.keys(filtered).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("discord_monitored_channels")
      .update(filtered)
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Channel not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("PUT /api/sources/discord/channels error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update channel" },
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
      .from("discord_monitored_channels")
      .update({ is_active: false })
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Channel not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("DELETE /api/sources/discord/channels error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete channel" },
      { status: 500 }
    );
  }
}
