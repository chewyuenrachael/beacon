import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ingestHackerNews } from "@/lib/sources/hn";
import { ingestReddit } from "@/lib/sources/reddit";
import { ingestYouTube } from "@/lib/sources/youtube";
import { ingestRSS } from "@/lib/sources/rss";
import type { MentionRaw, IngestionResult } from "@/lib/types";

async function upsertMentions(mentions: MentionRaw[]) {
  if (mentions.length === 0) return 0;

  const rows = mentions.map((m) => ({
    source: m.source,
    source_id: m.source_id,
    source_url: m.source_url,
    title: m.title,
    body: m.body,
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
  return data?.length ?? 0;
}

export async function POST() {
  try {
    const results = await Promise.allSettled([
      ingestHackerNews(),
      ingestReddit(),
      ingestYouTube(),
      ingestRSS(),
    ]);

    const sourceNames = ["hackernews", "reddit", "youtube", "rss"] as const;
    const ingestionResults: IngestionResult[] = [];
    let totalNew = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const sourceName = sourceNames[i];

      if (result.status === "fulfilled") {
        const mentions = result.value;
        try {
          const newCount = await upsertMentions(mentions);
          totalNew += newCount;
          ingestionResults.push({
            source: sourceName,
            mentions_found: mentions.length,
            mentions_new: newCount,
            errors: [],
          });
        } catch (err) {
          ingestionResults.push({
            source: sourceName,
            mentions_found: mentions.length,
            mentions_new: 0,
            errors: [err instanceof Error ? err.message : "Upsert failed"],
          });
        }
      } else {
        ingestionResults.push({
          source: sourceName,
          mentions_found: 0,
          mentions_new: 0,
          errors: [result.reason?.message ?? "Ingestion failed"],
        });
      }
    }

    return NextResponse.json({
      results: ingestionResults,
      total_new: totalNew,
    });
  } catch (error) {
    console.error("POST /api/ingest error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ingestion failed" },
      { status: 500 }
    );
  }
}
