import { NextResponse } from "next/server";
import {
  generateOutreachDraft,
  mapOutreachTouchpointRow,
} from "@/lib/outreach-generator";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { outreachIdParamsSchema } from "../../schemas";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const rawParams = await context.params;
  const parsedId = outreachIdParamsSchema.safeParse(rawParams);
  if (!parsedId.success) {
    return NextResponse.json(
      {
        error: parsedId.error.flatten().fieldErrors.id?.[0] ?? "Invalid id",
        code: "VALIDATION",
      },
      { status: 400 }
    );
  }

  const { data: row, error } = await supabaseAdmin
    .from("outreach_touchpoints")
    .select("*")
    .eq("id", parsedId.data.id)
    .maybeSingle();

  if (error) {
    console.error("[api/outreach/[id]/draft GET]", error);
    return NextResponse.json(
      { error: error.message, code: "DB_ERROR" },
      { status: 500 }
    );
  }

  if (!row) {
    return NextResponse.json(
      { error: "Touchpoint not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const t = mapOutreachTouchpointRow(row as Record<string, unknown>);
  return NextResponse.json({
    subject_line: t.subject_line,
    draft_content: t.draft_content,
  });
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const rawParams = await context.params;
  const parsedId = outreachIdParamsSchema.safeParse(rawParams);
  if (!parsedId.success) {
    return NextResponse.json(
      {
        error: parsedId.error.flatten().fieldErrors.id?.[0] ?? "Invalid id",
        code: "VALIDATION",
      },
      { status: 400 }
    );
  }

  const { data: row, error: loadErr } = await supabaseAdmin
    .from("outreach_touchpoints")
    .select("*")
    .eq("id", parsedId.data.id)
    .maybeSingle();

  if (loadErr || !row) {
    return NextResponse.json(
      { error: "Touchpoint not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const touchpoint = mapOutreachTouchpointRow(row as Record<string, unknown>);

  try {
    const draft = await generateOutreachDraft(
      touchpoint.target_type,
      touchpoint.target_id,
      { touchpointId: touchpoint.id }
    );

    const { data: updated, error: updErr } = await supabaseAdmin
      .from("outreach_touchpoints")
      .update({
        subject_line: draft.subject_line,
        draft_content: draft.body,
      })
      .eq("id", touchpoint.id)
      .select()
      .single();

    if (updErr || !updated) {
      console.error("[api/outreach/[id]/draft POST]", updErr);
      return NextResponse.json(
        { error: updErr?.message ?? "Update failed", code: "DB_ERROR" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        subject_line: draft.subject_line,
        draft_content: draft.body,
        tone: draft.tone,
        referenced_facts: draft.referenced_facts,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Regenerate failed";
    console.error("[api/outreach/[id]/draft POST]", e);
    return NextResponse.json(
      { error: message, code: "DRAFT_FAILED" },
      { status: 500 }
    );
  }
}
