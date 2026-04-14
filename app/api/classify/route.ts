import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { classifyBatch } from "@/lib/classify";
import { sendSingleFireAlert } from "@/lib/alerts";
import { routeMentionToAudiences } from "@/lib/audience-routing";
import type { ClassificationInput } from "@/lib/types";

const VALID_TOPICS = [
  "safety-alignment",
  "developer-experience",
  "enterprise-adoption",
  "competitive-positioning",
  "pricing-access",
  "open-source-ecosystem",
  "regulation-policy",
] as const;

async function backfillTopics(): Promise<Response> {
  const { data: mentions, error: fetchError } = await supabaseAdmin
    .from("mentions")
    .select("id, title, summary, body")
    .not("classified_at", "is", null)
    .is("topic", null)
    .order("published_at", { ascending: false })
    .limit(50);

  if (fetchError) throw fetchError;

  if (!mentions || mentions.length === 0) {
    return NextResponse.json({ backfilled: 0, message: "No mentions need topic backfill" });
  }

  let backfilledCount = 0;
  for (const mention of mentions) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 50,
          messages: [
            {
              role: "user",
              content: `Given this content about AI/developer tools, classify its primary narrative theme. Pick exactly ONE:
- safety-alignment
- developer-experience
- enterprise-adoption
- competitive-positioning
- pricing-access
- open-source-ecosystem
- regulation-policy

Title: ${mention.title || ""}
Summary: ${mention.summary || ""}
Body: ${(mention.body || "").substring(0, 500)}

Respond with ONLY the topic string, nothing else.`,
            },
          ],
        }),
      });

      const data = await response.json();
      const topicResult = data.content?.[0]?.text?.trim() || "";
      const validTopic = VALID_TOPICS.includes(topicResult as typeof VALID_TOPICS[number])
        ? topicResult
        : null;

      if (validTopic) {
        const { error: updateError } = await supabaseAdmin
          .from("mentions")
          .update({ topic: validTopic })
          .eq("id", mention.id);

        if (!updateError) backfilledCount++;
      }

      // Rate limit
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Topic backfill failed for ${mention.id}:`, error);
    }
  }

  return NextResponse.json({ backfilled: backfilledCount, total: mentions.length });
}

const VALID_AUDIENCES = ["product", "engineering", "safety", "policy", "executive"];

async function backfillAudiences(): Promise<Response> {
  // Get IDs of mentions that already have routes
  const { data: routedRows } = await supabaseAdmin
    .from("mention_audience_routes")
    .select("mention_id");

  const routedIds = new Set((routedRows || []).map((r: { mention_id: string }) => r.mention_id));

  // Get classified mentions without routes
  const { data: mentions, error: fetchError } = await supabaseAdmin
    .from("mentions")
    .select("id, title, summary, urgency, topic, source")
    .not("classified_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(200);

  if (fetchError) throw fetchError;

  const unrouted = (mentions || []).filter((m: { id: string }) => !routedIds.has(m.id)).slice(0, 50);

  if (unrouted.length === 0) {
    return NextResponse.json({ backfilled: 0, message: "No mentions need audience backfill" });
  }

  let backfilledCount = 0;
  for (const mention of unrouted) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          messages: [
            {
              role: "user",
              content: `Given this developer mention about AI tools, score its relevance to each internal team (0-2).
0 = not relevant, 1 = somewhat relevant, 2 = highly relevant.

Title: ${mention.title || ""}
Summary: ${mention.summary || ""}
Urgency: ${mention.urgency || "noise"}
Topic: ${mention.topic || "unknown"}
Source: ${mention.source || ""}

Return JSON only:
{ "audience_relevance": [
  { "slug": "product", "relevance": 0, "reason": "one line" },
  { "slug": "engineering", "relevance": 0, "reason": "one line" },
  { "slug": "safety", "relevance": 0, "reason": "one line" },
  { "slug": "policy", "relevance": 0, "reason": "one line" },
  { "slug": "executive", "relevance": 0, "reason": "one line" }
]}`,
            },
          ],
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text?.trim() || "";

      try {
        const parsed = JSON.parse(text);
        const ar = Array.isArray(parsed.audience_relevance) ? parsed.audience_relevance : [];
        const validAr = ar.filter(
          (a: { slug: string }) => VALID_AUDIENCES.includes(a.slug)
        );

        if (validAr.length > 0) {
          await routeMentionToAudiences(mention.id, validAr, mention.urgency || "noise");
          backfilledCount++;
        }
      } catch {
        console.error(`Audience backfill JSON parse failed for ${mention.id}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Audience backfill failed for ${mention.id}:`, error);
    }
  }

  return NextResponse.json({ backfilled: backfilledCount, total: unrouted.length });
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const backfill = url.searchParams.get("backfill");

    if (backfill === "topics") {
      return backfillTopics();
    }

    if (backfill === "audiences") {
      return backfillAudiences();
    }

    const { data: unclassified, error: fetchError } = await supabaseAdmin
      .from("mentions")
      .select("id, source, title, body, author, engagement_score, published_at")
      .is("classified_at", null)
      .order("published_at", { ascending: false })
      .limit(50);

    if (fetchError) throw fetchError;

    if (!unclassified || unclassified.length === 0) {
      return NextResponse.json({ classified: 0, message: "No unclassified mentions" });
    }

    const inputs: ClassificationInput[] = unclassified.map((m) => ({
      source: m.source,
      title: m.title ?? "",
      body: m.body ?? "",
      author: m.author ?? "",
      engagement_score: m.engagement_score,
      published_at: m.published_at,
    }));

    const outputs = await classifyBatch(inputs);

    let classifiedCount = 0;
    for (let i = 0; i < unclassified.length; i++) {
      const classification = outputs[i];
      if (!classification) continue;

      const { error: updateError } = await supabaseAdmin
        .from("mentions")
        .update({
          urgency: classification.urgency,
          urgency_reason: classification.urgency_reason,
          summary: classification.summary,
          recommended_action: classification.recommended_action,
          hope_score: classification.hope_score,
          concern_score: classification.concern_score,
          tension_type: classification.tension_type ?? null,
          primary_emotion: classification.primary_emotion ?? null,
          topic: classification.topic ?? null,
          is_competitor_mention: classification.is_competitor_mention ?? false,
          competitor_names: classification.competitor_names ?? [],
          credibility_signal: classification.credibility_signal ?? null,
          topics: classification.topics ?? [],
          inferred_region: classification.inferred_region ?? null,
          classified_at: new Date().toISOString(),
          classification_raw: classification as unknown as Record<string, unknown>,
        })
        .eq("id", unclassified[i].id);

      if (!updateError) {
        classifiedCount++;

        // Route to audiences
        if (classification.audience_relevance && classification.audience_relevance.length > 0) {
          try {
            await routeMentionToAudiences(
              unclassified[i].id,
              classification.audience_relevance,
              classification.urgency
            );
          } catch (e) {
            console.error("Audience routing failed:", e);
          }
        }

        if (classification.urgency === "fire") {
          try {
            await sendSingleFireAlert(unclassified[i], classification);
          } catch (e) {
            console.error("Slack fire alert failed:", e);
          }
        }
      }
    }

    return NextResponse.json({ classified: classifiedCount });
  } catch (error) {
    console.error("POST /api/classify error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Classification failed" },
      { status: 500 }
    );
  }
}
