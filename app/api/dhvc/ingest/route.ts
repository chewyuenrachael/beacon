// @ownership dhvc-module

import { NextResponse } from "next/server";

import { runDhvcIngestion } from "@/lib/dhvc-orchestrator";

/**
 * POST /api/dhvc/ingest
 *
 * Runs the three DHVC scrapers (Devpost, GitHub, arXiv-undergrads), merges
 * results into `dhvc_candidates`, scores each row, and writes observations.
 *
 * Body: none (reserved for future filters).
 *
 * Errors:
 *   - INGEST_FAILED  500 — unrecoverable failure before any source ran
 */
export async function POST(_request: Request) {
  try {
    const results = await runDhvcIngestion();
    return NextResponse.json({ results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ingest failed";
    console.error("[api/dhvc/ingest POST]", e);
    return NextResponse.json(
      { error: message, code: "INGEST_FAILED" },
      { status: 500 }
    );
  }
}
