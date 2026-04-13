import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { transformResponse } from "../../_transform";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from("llm_responses")
      .select(
        "*, probe:llm_probes(*), classification:llm_response_classifications(*)"
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Response not found" },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json(transformResponse(data));
  } catch (error) {
    console.error("GET /api/llm-monitor/responses/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch response" },
      { status: 500 }
    );
  }
}
