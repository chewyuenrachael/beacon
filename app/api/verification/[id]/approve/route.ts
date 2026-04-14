import { NextResponse } from "next/server";
import { logObservation } from "@/lib/observations";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { inferInstitutionEntityId } from "@/lib/sheerid-mock";
import {
  approveVerificationBodySchema,
  verificationIdParamsSchema,
} from "../../schemas";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const rawParams = await context.params;
  const paramsParsed = verificationIdParamsSchema.safeParse(rawParams);
  if (!paramsParsed.success) {
    return NextResponse.json(
      { error: "Invalid verification id", code: "VALIDATION" },
      { status: 400 }
    );
  }
  const { id } = paramsParsed.data;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "VALIDATION" },
      { status: 400 }
    );
  }

  const parsed = approveVerificationBodySchema.safeParse(body);
  if (!parsed.success) {
    const msg =
      parsed.error.flatten().fieldErrors.institution_id?.[0] ?? "Invalid body";
    return NextResponse.json({ error: msg, code: "VALIDATION" }, { status: 400 });
  }

  const { institution_id, reviewed_by } = parsed.data;
  const reviewedAt = new Date().toISOString();

  try {
    const { data: attempt, error: loadErr } = await supabaseAdmin
      .from("verification_attempts")
      .select("*")
      .eq("id", id)
      .single();

    if (loadErr || !attempt) {
      return NextResponse.json(
        { error: "Verification attempt not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const { data: inst, error: instErr } = await supabaseAdmin
      .from("institutions")
      .select("id")
      .eq("id", institution_id)
      .maybeSingle();

    if (instErr) throw instErr;
    if (!inst) {
      return NextResponse.json(
        { error: "Unknown institution_id", code: "VALIDATION" },
        { status: 400 }
      );
    }

    const email = attempt.email as string;

    const { data: updated, error: updErr } = await supabaseAdmin
      .from("verification_attempts")
      .update({
        status: "approved",
        reviewed_at: reviewedAt,
        reviewed_by: reviewed_by ?? null,
      })
      .eq("id", id)
      .select()
      .single();

    if (updErr) throw updErr;

    await logObservation({
      entity_type: "institution",
      entity_id: institution_id,
      observation_type: "cursor_user_institution_mapped",
      payload: {
        verification_attempt_id: id,
        email,
        institution_id,
        mapped_via: "manual_discount_approval",
      },
      source: "manual",
      confidence: 1.0,
    });

    await logObservation({
      entity_type: "institution",
      entity_id: inferInstitutionEntityId(email),
      observation_type: "action_completed",
      payload: {
        kind: "verification_approved",
        verification_attempt_id: id,
        email,
        institution_id,
      },
      source: "manual",
      confidence: 1.0,
    });

    return NextResponse.json(updated);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Approve failed";
    console.error("[verification approve]", id, e);
    return NextResponse.json(
      { error: message, code: "APPROVE_FAILED" },
      { status: 500 }
    );
  }
}
