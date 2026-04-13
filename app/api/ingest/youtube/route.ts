import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ingestYouTube } from "@/lib/sources/youtube";
import { cleanMentionText } from "@/lib/sources";

export async function POST() {
  try {
    const mentions = await ingestYouTube();

    const rows = mentions.map((m) => ({
      source: m.source,
      source_id: m.source_id,
      source_url: m.source_url,
      title: cleanMentionText(m.title),
      body: cleanMentionText(m.body),
      author: m.author,
      author_karma: m.author_karma,
      engagement_score: m.engagement_score,
      published_at: m.published_at,
      fetched_at: m.fetched_at,
      raw_json: JSON.parse(m.raw_json),
    }));

    const { data, error } = await supabaseAdmin
      .from("mentions")
      .upsert(rows, { onConflict: "source,source_id", ignoreDuplicates: true })
      .select("id");

    if (error) throw error;

    return NextResponse.json({
      source: "youtube",
      mentions_found: mentions.length,
      mentions_new: data?.length ?? 0,
    });
  } catch (error) {
    console.error("POST /api/ingest/youtube error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "YouTube ingestion failed" },
      { status: 500 }
    );
  }
}
