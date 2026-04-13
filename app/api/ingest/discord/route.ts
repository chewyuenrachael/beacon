import { NextResponse } from "next/server";
import { ingestDiscord } from "@/lib/ingest-discord";

export async function POST() {
  try {
    const result = await ingestDiscord();

    return NextResponse.json({
      source: "discord",
      mentions_ingested: result.ingested,
      mentions_skipped: result.skipped,
    });
  } catch (error) {
    console.error("POST /api/ingest/discord error:", error);
    return NextResponse.json(
      {
        error: JSON.stringify(error, Object.getOwnPropertyNames(error || {})),
      },
      { status: 500 }
    );
  }
}
