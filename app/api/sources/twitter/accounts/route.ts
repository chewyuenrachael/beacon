import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const VALID_CATEGORIES = [
  "anthropic-official",
  "competitor-official",
  "ai-researcher",
  "developer-advocate",
  "tech-journalist",
  "influencer",
  "general",
];

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const activeOnly = params.get("active_only") !== "false";
    const category = params.get("category");

    let query = supabaseAdmin
      .from("twitter_monitored_accounts")
      .select("*")
      .order("username");

    if (activeOnly) {
      query = query.eq("is_active", true);
    }
    if (category) {
      query = query.eq("category", category);
    }

    const { data: accounts, error } = await query;
    if (error) throw error;

    const allAccounts = accounts || [];

    // Enrich with last_mention_at and mention_count from mentions table
    const usernames = allAccounts.map((a) => a.username);
    let mentionStats: Record<string, { count: number; last_at: string | null }> = {};

    if (usernames.length > 0) {
      const { data: mentions } = await supabaseAdmin
        .from("mentions")
        .select("author, published_at")
        .eq("source", "twitter")
        .in("author", usernames);

      for (const m of mentions || []) {
        if (!mentionStats[m.author]) {
          mentionStats[m.author] = { count: 0, last_at: null };
        }
        mentionStats[m.author].count++;
        if (!mentionStats[m.author].last_at || m.published_at > mentionStats[m.author].last_at!) {
          mentionStats[m.author].last_at = m.published_at;
        }
      }
    }

    const enriched = allAccounts.map((a) => ({
      ...a,
      last_mention_at: mentionStats[a.username]?.last_at || null,
      mention_count: mentionStats[a.username]?.count || 0,
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("GET /api/sources/twitter/accounts error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.username || typeof body.username !== "string") {
      return NextResponse.json(
        { error: "username is required" },
        { status: 400 }
      );
    }

    const username = body.username.replace(/^@/, "").trim();
    if (!username) {
      return NextResponse.json(
        { error: "username must not be empty" },
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
      .from("twitter_monitored_accounts")
      .insert({
        username,
        display_name: body.display_name || null,
        category: body.category || "general",
        twitter_user_id: body.twitter_user_id || null,
        notes: body.notes || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/sources/twitter/accounts error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create account" },
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

    const allowed = ["username", "display_name", "category", "twitter_user_id", "is_active", "notes"];
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

    // Strip @ from username if present in update
    if (typeof filtered.username === "string") {
      filtered.username = (filtered.username as string).replace(/^@/, "").trim();
      if (!(filtered.username as string)) {
        return NextResponse.json(
          { error: "username must not be empty" },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from("twitter_monitored_accounts")
      .update(filtered)
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("PUT /api/sources/twitter/accounts error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update account" },
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
      .from("twitter_monitored_accounts")
      .update({ is_active: false })
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("DELETE /api/sources/twitter/accounts error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete account" },
      { status: 500 }
    );
  }
}
