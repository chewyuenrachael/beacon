import { NextResponse } from "next/server";
import { ingestTwitter } from "@/lib/ingest-twitter";

export async function POST() {
  try {
    const result = await ingestTwitter();

    return NextResponse.json({
      source: "twitter",
      mentions_ingested: result.ingested,
      mentions_skipped: result.skipped,
    });
  } catch (error) {
    console.error("POST /api/ingest/twitter error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Twitter ingestion failed",
      },
      { status: 500 }
    );
  }
}
