import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await params;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("daily_briefs")
      .select("*")
      .eq("brief_date", date)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Brief not found for this date" },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/brief/[date] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch brief" },
      { status: 500 }
    );
  }
}
