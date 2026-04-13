import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("daily_briefs")
      .select("*")
      .order("brief_date", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(null, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/brief/latest error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch latest brief" },
      { status: 500 }
    );
  }
}
