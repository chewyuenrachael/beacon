// @ownership dhvc-module

import { NextResponse } from "next/server";

import { mapDhvcCandidateRow } from "@/lib/dhvc-orchestrator";
import { logObservation } from "@/lib/observations";
import { supabaseAdmin } from "@/lib/supabase-admin";

import { acceptCandidateBodySchema, dhvcIdParamsSchema } from "../../../schemas";

const TERMINAL_STAGES = new Set(["accepted", "rejected", "archived"]);

/**
 * POST /api/dhvc/candidates/[id]/accept
 *
 * Transitions `review_stage` to `accepted`. Logs `dhvc_candidate_accepted`.
 * Returns the updated candidate.
 *
 * Errors:
 *   VALIDATION           400
 *   NOT_FOUND            404
 *   ILLEGAL_TRANSITION   400 — already in a terminal stage
 *   UPDATE_FAILED        500
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const raw = await context.params;
  const parsedId = dhvcIdParamsSchema.safeParse(raw);
  if (!parsedId.success) {
    return NextResponse.json(
      {
        error: parsedId.error.flatten().fieldErrors.id?.[0] ?? "Invalid id",
        code: "VALIDATION",
      },
      { status: 400 }
    );
  }

  let json: unknown = {};
  try {
    json = (await request.json().catch(() => ({}))) ?? {};
  } catch {
    json = {};
  }

  const parsedBody = acceptCandidateBodySchema.safeParse(json);
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

  const id = parsedId.data.id;
  const body = parsedBody.data;

  try {
    const { data: existing, error: loadErr } = await supabaseAdmin
      .from("dhvc_candidates")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (loadErr) throw loadErr;
    if (!existing) {
      return NextResponse.json(
        { error: "DHVC candidate not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const candidate = mapDhvcCandidateRow(existing as Record<string, unknown>);
    if (candidate.review_stage === "accepted") {
      return NextResponse.json(candidate);
    }
    if (TERMINAL_STAGES.has(candidate.review_stage)) {
      return NextResponse.json(
        {
          error: `Cannot accept candidate already in ${candidate.review_stage}`,
          code: "ILLEGAL_TRANSITION",
        },
        { status: 400 }
      );
    }

    const reviewedAt = new Date().toISOString();

    await logObservation({
      entity_type: "dhvc_candidate",
      entity_id: id,
      observation_type: "dhvc_candidate_accepted",
      payload: {
        from_stage: candidate.review_stage,
        reviewed_by: body.reviewed_by ?? null,
        notes: body.notes ?? null,
        create_outreach_touchpoint: body.create_outreach_touchpoint ?? false,
      },
      source: "manual",
      confidence: 1.0,
    });

    const patch: Record<string, unknown> = {
      review_stage: "accepted",
      reviewed_at: reviewedAt,
    };
    if (body.reviewed_by) patch.reviewed_by = body.reviewed_by;
    if (body.notes) patch.notes = body.notes;

    const { data: updated, error: updErr } = await supabaseAdmin
      .from("dhvc_candidates")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (updErr || !updated) {
      throw new Error(updErr?.message ?? "DHVC update failed");
    }

    return NextResponse.json(
      mapDhvcCandidateRow(updated as Record<string, unknown>)
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Accept failed";
    console.error("[api/dhvc/candidates/[id]/accept POST]", e);
    return NextResponse.json(
      { error: message, code: "UPDATE_FAILED" },
      { status: 500 }
    );
  }
}
