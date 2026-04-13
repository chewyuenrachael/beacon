import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const searchParams = request.nextUrl.searchParams;
    const history = searchParams.get("history");
    const date = searchParams.get("date");

    // History mode: return last 7 briefs
    if (history === "true") {
      const { data, error } = await supabaseAdmin
        .from("audience_briefs")
        .select("*")
        .eq("audience_slug", slug)
        .order("brief_date", { ascending: false })
        .limit(7);

      if (error) throw error;
      return NextResponse.json(data || []);
    }

    // Specific date or most recent
    let query = supabaseAdmin
      .from("audience_briefs")
      .select("*")
      .eq("audience_slug", slug);

    if (date) {
      query = query.eq("brief_date", date);
    } else {
      query = query.order("brief_date", { ascending: false }).limit(1);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: `No brief found for audience "${slug}"${date ? ` on ${date}` : ""}` },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/briefs/audience/[slug] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch brief" },
      { status: 500 }
    );
  }
}
