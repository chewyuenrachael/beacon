import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { manualRouteToAudience, removeManualRoute } from "@/lib/audience-routing";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updatePayload: Record<string, unknown> = {};

    if (body.is_reviewed !== undefined) {
      updatePayload.is_reviewed = body.is_reviewed;
      if (body.is_reviewed) {
        updatePayload.reviewed_at = new Date().toISOString();
      }
    }
    if (body.reviewed_by !== undefined) {
      updatePayload.reviewed_by = body.reviewed_by;
    }
    if (body.notes !== undefined) {
      updatePayload.notes = body.notes;
    }
    if (body.is_bookmarked !== undefined) {
      updatePayload.is_bookmarked = body.is_bookmarked;
    }
    if (body.flag_type !== undefined) {
      updatePayload.flag_type = body.flag_type;
    }

    // Handle audience routing separately
    if (body.audience_slug && body.action) {
      if (body.action === "add") {
        await manualRouteToAudience(id, body.audience_slug);
      } else if (body.action === "remove") {
        await removeManualRoute(id, body.audience_slug);
      }
      if (Object.keys(updatePayload).length === 0) {
        return NextResponse.json({ success: true });
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("mentions")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Mention not found" },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("PATCH /api/mentions/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update mention" },
      { status: 500 }
    );
  }
}
