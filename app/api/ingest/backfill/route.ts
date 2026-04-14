import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { cleanMentionText } from "@/lib/sources";

// ── Types (matching existing source libs) ──────────────────

interface HNHit {
  objectID: string;
  title: string | null;
  url: string | null;
  story_text: string | null;
  comment_text: string | null;
  author: string;
  points: number | null;
  num_comments: number | null;
  created_at: string;
  story_url: string;
  story_title: string | null;
  parent_id: number | null;
  story_id: number | null;
}

interface HNSearchResponse {
  hits: HNHit[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
}

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  body?: string;
  author: string;
  score: number;
  num_comments: number;
  permalink: string;
  created_utc: number;
}

interface RedditListingResponse {
  data: {
    children: Array<{ data: RedditPost }>;
  };
}

// ── Config ─────────────────────────────────────────────────

const HN_QUERIES = [
  "anthropic",
  "claude code",
  "claude ai",
  "claude sonnet",
  "claude opus",
];

const REDDIT_SUBREDDITS = [
  "ClaudeAI",
  "ChatGPTPro",
  "LocalLLaMA",
  "programming",
  "artificial",
];

const REDDIT_USER_AGENT = "Beacon/1.0 (comms-intelligence-tool)";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── HN Backfill ────────────────────────────────────────────

async function backfillHN(): Promise<{ found: number; new: number }> {
  const thirtyDaysAgo = Math.floor(
    (Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000
  );

  const seenIds = new Set<string>();
  const rows: Record<string, unknown>[] = [];

  for (const query of HN_QUERIES) {
    try {
      const params = new URLSearchParams({
        query: query,
        tags: "story",
        numericFilters: `created_at_i>${thirtyDaysAgo}`,
        hitsPerPage: "50",
      });

      const res = await fetch(
        `https://hn.algolia.com/api/v1/search?${params}`
      );
      if (!res.ok) {
        console.error(`[backfill-hn] API error for "${query}": ${res.status}`);
        continue;
      }

      const data: HNSearchResponse = await res.json();

      for (const hit of data.hits) {
        if (seenIds.has(hit.objectID)) continue;
        seenIds.add(hit.objectID);

        rows.push({
          source: "hackernews",
          source_id: hit.objectID,
          source_url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          title: cleanMentionText(
            hit.title || `Comment on: ${hit.story_title || "Unknown"}`
          ),
          body: cleanMentionText(
            hit.comment_text || hit.story_text || ""
          ),
          author: hit.author,
          author_karma: null,
          engagement_score: (hit.points || 0) + (hit.num_comments || 0),
          published_at: hit.created_at,
          fetched_at: new Date().toISOString(),
          raw_json: hit,
        });
      }

      console.log(
        `[backfill-hn] "${query}": ${data.hits.length} hits`
      );
    } catch (err) {
      console.error(`[backfill-hn] Failed for "${query}":`, err);
    }

    await delay(200);
  }

  if (rows.length === 0) return { found: 0, new: 0 };

  const { data, error } = await supabaseAdmin
    .from("mentions")
    .upsert(rows, { onConflict: "source,source_id", ignoreDuplicates: true })
    .select("id");

  if (error) {
    console.error("[backfill-hn] Upsert error:", error);
    return { found: rows.length, new: 0 };
  }

  return { found: rows.length, new: data?.length ?? 0 };
}

// ── Reddit Backfill ────────────────────────────────────────

async function backfillReddit(): Promise<{ found: number; new: number }> {
  const seenIds = new Set<string>();
  const rows: Record<string, unknown>[] = [];

  for (const sub of REDDIT_SUBREDDITS) {
    try {
      const url = `https://www.reddit.com/r/${sub}/search.json?q=anthropic+OR+claude&restrict_sr=on&sort=new&t=month&limit=50`;
      const res = await fetch(url, {
        headers: { "User-Agent": REDDIT_USER_AGENT },
      });

      if (res.status === 429) {
        console.warn(`[backfill-reddit] Rate limited on r/${sub}, skipping`);
        await delay(5000);
        continue;
      }
      if (!res.ok) {
        console.error(
          `[backfill-reddit] API error for r/${sub}: ${res.status}`
        );
        continue;
      }

      const listing: RedditListingResponse = await res.json();

      for (const child of listing.data.children) {
        const post = child.data;
        if (seenIds.has(post.id)) continue;
        seenIds.add(post.id);

        rows.push({
          source: "reddit",
          source_id: post.id,
          source_url: `https://reddit.com${post.permalink}`,
          title: cleanMentionText(post.title || ""),
          body: cleanMentionText(post.selftext || post.body || ""),
          author: post.author,
          author_karma: null,
          engagement_score: post.score + post.num_comments,
          published_at: new Date(post.created_utc * 1000).toISOString(),
          fetched_at: new Date().toISOString(),
          raw_json: post,
        });
      }

      console.log(
        `[backfill-reddit] r/${sub}: ${listing.data.children.length} results`
      );
    } catch (err) {
      console.error(`[backfill-reddit] Failed for r/${sub}:`, err);
    }

    await delay(1000);
  }

  if (rows.length === 0) return { found: 0, new: 0 };

  const { data, error } = await supabaseAdmin
    .from("mentions")
    .upsert(rows, { onConflict: "source,source_id", ignoreDuplicates: true })
    .select("id");

  if (error) {
    console.error("[backfill-reddit] Upsert error:", error);
    return { found: rows.length, new: 0 };
  }

  return { found: rows.length, new: data?.length ?? 0 };
}

// ── Route Handler ──────────────────────────────────────────

export async function POST() {
  try {
    const [hn, reddit] = await Promise.all([
      backfillHN(),
      backfillReddit(),
    ]);

    return NextResponse.json({
      hackernews: hn,
      reddit: reddit,
      total_found: hn.found + reddit.found,
      total_new: hn.new + reddit.new,
    });
  } catch (error) {
    console.error("POST /api/ingest/backfill error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Backfill failed",
      },
      { status: 500 }
    );
  }
}
