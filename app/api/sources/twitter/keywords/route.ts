import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const VALID_CATEGORIES = ["primary", "competitor", "context"];

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const activeOnly = params.get("active_only") !== "false";
    const category = params.get("category");

    let query = supabaseAdmin
      .from("twitter_search_keywords")
      .select("*")
      .order("category")
      .order("keyword");

    if (activeOnly) {
      query = query.eq("is_active", true);
    }
    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("GET /api/sources/twitter/keywords error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch keywords" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.keyword || typeof body.keyword !== "string") {
      return NextResponse.json(
        { error: "keyword is required" },
        { status: 400 }
      );
    }

    const keyword = body.keyword.trim();
    if (!keyword) {
      return NextResponse.json(
        { error: "keyword must not be empty" },
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
      .from("twitter_search_keywords")
      .insert({
        keyword,
        category: body.category || "primary",
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/sources/twitter/keywords error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create keyword" },
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

    const allowed = ["keyword", "category", "is_active"];
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

    if (typeof filtered.keyword === "string") {
      filtered.keyword = (filtered.keyword as string).trim();
      if (!(filtered.keyword as string)) {
        return NextResponse.json(
          { error: "keyword must not be empty" },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from("twitter_search_keywords")
      .update(filtered)
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Keyword not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("PUT /api/sources/twitter/keywords error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update keyword" },
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
      .from("twitter_search_keywords")
      .update({ is_active: false })
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Keyword not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("DELETE /api/sources/twitter/keywords error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete keyword" },
      { status: 500 }
    );
  }
}
