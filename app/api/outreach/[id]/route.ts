import { NextResponse } from "next/server";
import { logObservation } from "@/lib/observations";
import {
  isLegalOutreachTransition,
  mapOutreachTouchpointRow,
} from "@/lib/outreach-generator";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  isProfessorLinkedTargetType,
  type OutreachStage,
} from "@/lib/types/outreach";
import { outreachIdParamsSchema, patchOutreachBodySchema } from "../schemas";

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
    console.error("[api/outreach/[id] GET]", error);
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

  const touchpoint = mapOutreachTouchpointRow(row as Record<string, unknown>);

  let professorFacts: Record<string, unknown> | null = null;
  if (isProfessorLinkedTargetType(touchpoint.target_type)) {
    const { data: prof } = await supabaseAdmin
      .from("professors")
      .select("*")
      .eq("id", touchpoint.target_id)
      .maybeSingle();
    if (prof) professorFacts = prof as Record<string, unknown>;
  }

  const { data: obs } = await supabaseAdmin
    .from("observations")
    .select("*")
    .eq("entity_type", "outreach")
    .eq("entity_id", parsedId.data.id)
    .order("observed_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    data: touchpoint,
    professor: professorFacts,
    observations: obs ?? [],
  });
}

export async function PATCH(
  request: Request,
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

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "VALIDATION" },
      { status: 400 }
    );
  }

  const parsedBody = patchOutreachBodySchema.safeParse(json);
  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        code: "VALIDATION",
        details: parsedBody.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { data: existing, error: loadErr } = await supabaseAdmin
    .from("outreach_touchpoints")
    .select("*")
    .eq("id", parsedId.data.id)
    .maybeSingle();

  if (loadErr || !existing) {
    return NextResponse.json(
      { error: "Touchpoint not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const current = mapOutreachTouchpointRow(existing as Record<string, unknown>);
  const updates: Record<string, unknown> = {};

  if (parsedBody.data.stage !== undefined) {
    const from = current.stage as OutreachStage;
    const to = parsedBody.data.stage;
    if (!isLegalOutreachTransition(from, to)) {
      return NextResponse.json(
        {
          error: `Illegal stage transition: ${from} → ${to}`,
          code: "ILLEGAL_TRANSITION",
        },
        { status: 400 }
      );
    }
    updates.stage = to;
  }

  if (parsedBody.data.notes !== undefined) updates.notes = parsedBody.data.notes;
  if (parsedBody.data.sent_at !== undefined)
    updates.sent_at = parsedBody.data.sent_at;
  if (parsedBody.data.reply_detected_at !== undefined)
    updates.reply_detected_at = parsedBody.data.reply_detected_at;
  if (parsedBody.data.subject_line !== undefined)
    updates.subject_line = parsedBody.data.subject_line;
  if (parsedBody.data.draft_content !== undefined)
    updates.draft_content = parsedBody.data.draft_content;

  const hadSent = current.sent_at;
  const hadReply = current.reply_detected_at;

  const { data: updated, error: updErr } = await supabaseAdmin
    .from("outreach_touchpoints")
    .update(updates)
    .eq("id", parsedId.data.id)
    .select()
    .single();

  if (updErr || !updated) {
    console.error("[api/outreach/[id] PATCH]", updErr);
    return NextResponse.json(
      { error: updErr?.message ?? "Update failed", code: "DB_ERROR" },
      { status: 500 }
    );

  }

  const next = mapOutreachTouchpointRow(updated as Record<string, unknown>);

  try {
    if (
      parsedBody.data.sent_at !== undefined &&
      parsedBody.data.sent_at &&
      !hadSent &&
      next.sent_at
    ) {
      await logObservation({
        entity_type: "outreach",
        entity_id: parsedId.data.id,
        observation_type: "outreach_sent",
        payload: {
          sent_at: next.sent_at,
          subject_line: next.subject_line,
          channel: next.channel,
        },
        source: "manual",
        confidence: 1,
      });
    }
    if (
      parsedBody.data.reply_detected_at !== undefined &&
      parsedBody.data.reply_detected_at !== hadReply &&
      next.reply_detected_at
    ) {
      await logObservation({
        entity_type: "outreach",
        entity_id: parsedId.data.id,
        observation_type: "outreach_reply_detected",
        payload: { reply_detected_at: next.reply_detected_at },
        source: "manual",
        confidence: 1,
      });
    }
  } catch (e) {
    console.error("[api/outreach/[id] PATCH observation]", e);
  }

  return NextResponse.json({ data: next });
}
