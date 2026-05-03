// @ownership dhvc-module

import { NextResponse } from "next/server";

import {
  mapDhvcCandidateRow,
  persistManualDhvcDraft,
} from "@/lib/dhvc-orchestrator";
import { supabaseAdmin } from "@/lib/supabase-admin";

import {
  dhvcCandidateDraftSchema,
  listCandidatesQuerySchema,
} from "../schemas";

/**
 * GET /api/dhvc/candidates
 *
 * Query params:
 *   review_stage     pending_review | accepted | rejected | archived
 *   institution_id   institutions.id slug
 *   primary_source   devpost | github | arxiv | manual
 *   min_score        0..100 (filters by score.total)
 *   limit            1..200, default 50
 *   cursor           opaque next-page cursor (currently unused)
 *
 * Errors:
 *   VALIDATION    400 — invalid query params
 *   DB_ERROR      500 — Supabase failure
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const parsed = listCandidatesQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid query params",
        code: "VALIDATION",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const q = parsed.data;
  let query = supabaseAdmin.from("dhvc_candidates").select("*");

  if (q.review_stage) query = query.eq("review_stage", q.review_stage);
  if (q.institution_id) query = query.eq("institution_id", q.institution_id);
  if (q.primary_source) query = query.eq("primary_source", q.primary_source);
  if (typeof q.min_score === "number") {
    query = query.gte("score->>total", String(q.min_score));
  }

  query = query
    .order("score->>total", { ascending: false })
    .order("discovered_at", { ascending: false })
    .limit(q.limit);

  const { data, error } = await query;
  if (error) {
    console.error("[api/dhvc/candidates GET]", error);
    return NextResponse.json(
      { error: error.message, code: "DB_ERROR" },
      { status: 500 }
    );
  }

  const candidates = (data ?? []).map((row) =>
    mapDhvcCandidateRow(row as Record<string, unknown>)
  );

  return NextResponse.json({ candidates });
}

/**
 * POST /api/dhvc/candidates
 *
 * Manual creation path (Campus Lead enters someone they met in person).
 * Same persist + observation pipeline as the scrapers.
 *
 * Errors:
 *   VALIDATION    400 — bad body
 *   NOT_FOUND     400 — unknown institution_id
 *   CREATE_FAILED 500 — DB or pipeline failure
 */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "VALIDATION" },
      { status: 400 }
    );
  }

  const parsed = dhvcCandidateDraftSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        code: "VALIDATION",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  try {
    const { data: inst, error: instErr } = await supabaseAdmin
      .from("institutions")
      .select("id")
      .eq("id", parsed.data.institution_id)
      .maybeSingle();
    if (instErr) throw instErr;
    if (!inst) {
      return NextResponse.json(
        { error: "Unknown institution_id", code: "NOT_FOUND" },
        { status: 400 }
      );
    }

    const candidate = await persistManualDhvcDraft(parsed.data);
    return NextResponse.json(candidate, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    console.error("[api/dhvc/candidates POST]", e);
    return NextResponse.json(
      { error: message, code: "CREATE_FAILED" },
      { status: 500 }
    );
  }
}
