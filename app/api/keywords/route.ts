import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const VALID_CATEGORIES = ["primary", "competitor", "context"];

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("keywords")
      .select("*")
      .order("category")
      .order("keyword");

    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("GET /api/keywords error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch keywords" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keyword, category } = body;

    if (!keyword || typeof keyword !== "string") {
      return NextResponse.json(
        { error: "keyword is required and must be a string" },
        { status: 400 }
      );
    }

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("keywords")
      .insert({ keyword: keyword.trim(), category })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/keywords error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create keyword" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("keywords")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/keywords error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete keyword" },
      { status: 500 }
    );
  }
}
