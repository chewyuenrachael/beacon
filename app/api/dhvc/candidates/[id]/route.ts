// @ownership dhvc-module

import { NextResponse } from "next/server";

import { mapDhvcCandidateRow } from "@/lib/dhvc-orchestrator";
import {
  computeDhvcScoreFromCandidate,
  scoreDhvcCandidate,
} from "@/lib/dhvc-scoring";
import { logObservation } from "@/lib/observations";
import { supabaseAdmin } from "@/lib/supabase-admin";

import { dhvcIdParamsSchema, patchCandidateBodySchema } from "../../schemas";

/**
 * GET /api/dhvc/candidates/[id]
 *
 * Returns the candidate row + a recent observation timeline for the
 * `dhvc_candidate` entity (mirrors the professor detail view).
 *
 * Errors:
 *   VALIDATION    400 — invalid uuid
 *   NOT_FOUND     404
 *   DB_ERROR      500
 */
export async function GET(
  _request: Request,
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

  const id = parsedId.data.id;

  const { data: row, error } = await supabaseAdmin
    .from("dhvc_candidates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[api/dhvc/candidates/[id] GET]", error);
    return NextResponse.json(
      { error: error.message, code: "DB_ERROR" },
      { status: 500 }
    );
  }

  if (!row) {
    return NextResponse.json(
      { error: "DHVC candidate not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const candidate = mapDhvcCandidateRow(row as Record<string, unknown>);

  const { data: obsRows, error: obsErr } = await supabaseAdmin
    .from("observations")
    .select("*")
    .eq("entity_type", "dhvc_candidate")
    .eq("entity_id", id)
    .order("observed_at", { ascending: false })
    .limit(50);

  if (obsErr) {
    console.error("[api/dhvc/candidates/[id] GET obs]", obsErr);
    return NextResponse.json(
      { error: obsErr.message, code: "DB_ERROR" },
      { status: 500 }
    );
  }

  return NextResponse.json({ candidate, observations: obsRows ?? [] });
}

const SCORE_AFFECTING_FIELDS = new Set(["graduation_year"]);

/**
 * PATCH /api/dhvc/candidates/[id]
 *
 * Update notes, email, graduation_year, or major. Score-affecting fields
 * trigger a re-score and observation. Always logs `dhvc_candidate_enriched`.
 *
 * Errors:
 *   VALIDATION         400
 *   NOT_FOUND          404
 *   UPDATE_FAILED      500
 */
export async function PATCH(
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

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "VALIDATION" },
      { status: 400 }
    );
  }

  const parsedBody = patchCandidateBodySchema.safeParse(json);
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
  const updates = parsedBody.data;

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

    const patch: Record<string, unknown> = {};
    if (updates.notes !== undefined) patch.notes = updates.notes;
    if (updates.email !== undefined) patch.email = updates.email;
    if (updates.graduation_year !== undefined) {
      patch.graduation_year = updates.graduation_year;
    }
    if (updates.major !== undefined) patch.major = updates.major;

    const triggersRescore = Object.keys(updates).some((k) =>
      SCORE_AFFECTING_FIELDS.has(k)
    );

    if (triggersRescore) {
      const newScore = computeDhvcScoreFromCandidate({
        institution_id: candidate.institution_id,
        graduation_year:
          updates.graduation_year !== undefined
            ? updates.graduation_year ?? undefined
            : candidate.graduation_year,
        github_username: candidate.github_username,
        twitter_handle: candidate.twitter_handle,
        source_urls: candidate.source_urls,
      });
      patch.score = newScore;
    }

    await logObservation({
      entity_type: "dhvc_candidate",
      entity_id: id,
      observation_type: "dhvc_candidate_enriched",
      payload: { updates },
      source: "manual",
      confidence: 1.0,
    });

    const { data: updated, error: updErr } = await supabaseAdmin
      .from("dhvc_candidates")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (updErr || !updated) {
      throw new Error(updErr?.message ?? "DHVC update failed");
    }

    const refreshed = mapDhvcCandidateRow(updated as Record<string, unknown>);

    if (triggersRescore) {
      await scoreDhvcCandidate(refreshed);
    }

    return NextResponse.json(refreshed);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    console.error("[api/dhvc/candidates/[id] PATCH]", e);
    return NextResponse.json(
      { error: message, code: "UPDATE_FAILED" },
      { status: 500 }
    );
  }
}
