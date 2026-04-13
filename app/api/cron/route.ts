import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ingestHackerNews } from "@/lib/sources/hn";
import { ingestReddit } from "@/lib/sources/reddit";
import { ingestYouTube } from "@/lib/sources/youtube";
import { ingestRSS } from "@/lib/sources/rss";
import { classifyBatch } from "@/lib/classify";
import { updateEngagementSnapshots } from "@/lib/velocity";
import { generateDailyBrief } from "@/lib/brief";
import { sendFireAlert } from "@/lib/alerts";
import { scorePressmentions } from "@/lib/pullthrough";
import { scorePressMentions } from "@/lib/pull-through";
import { routeMentionToAudiences } from "@/lib/audience-routing";
import { profileJournalists } from "@/lib/journalist-profiler";
import { detectNarrativeGaps } from "@/lib/narrative-gap-detector";
import { generateNarrativeReport } from "@/lib/narrative-report-generator";
import { fetchLLMResponses } from "@/lib/llm-fetcher";
import { classifyLLMResponse } from "@/lib/llm-classifier";
import { generateLLMSnapshots } from "@/lib/llm-snapshot-generator";
import { processFireMention } from "@/lib/incident-manager";
import { ingestTwitter } from "@/lib/ingest-twitter";
import { ingestDiscord } from "@/lib/ingest-discord";
import { detectPropagation } from "@/lib/propagation-detector";
import type { MentionRaw, ClassificationInput } from "@/lib/types";

function getMondayOfThisWeek(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

async function upsertMentions(mentions: MentionRaw[]): Promise<number> {
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

export async function POST(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  // Create ingestion log
  const { data: log, error: logError } = await supabaseAdmin
    .from("ingestion_logs")
    .insert({ source: "cron", started_at: new Date().toISOString() })
    .select()
    .single();

  if (logError) {
    console.error("Failed to create ingestion log:", logError);
  }

  try {
    // 1. Ingest from all sources
    const ingestionResults = await Promise.allSettled([
      ingestHackerNews(),
      ingestReddit(),
      ingestYouTube(),
      ingestRSS(),
    ]);

    const allMentions: MentionRaw[] = [];
    for (const result of ingestionResults) {
      if (result.status === "fulfilled") {
        allMentions.push(...result.value);
      } else {
        console.error("Source ingestion failed:", result.reason);
      }
    }

    // 3. Deduplicate and insert
    const newCount = await upsertMentions(allMentions);

    // 3.5 Twitter & Discord ingestion (self-upserting adapters)
    let twitterIngested = 0;
    let discordIngested = 0;

    const [twitterResult, discordResult] = await Promise.allSettled([
      ingestTwitter(),
      ingestDiscord(),
    ]);

    if (twitterResult.status === "fulfilled") {
      twitterIngested = twitterResult.value.ingested;
      console.log(
        `Twitter: ${twitterResult.value.ingested} ingested, ${twitterResult.value.skipped} skipped`
      );
    } else {
      console.error("Twitter ingestion failed:", twitterResult.reason);
    }

    if (discordResult.status === "fulfilled") {
      discordIngested = discordResult.value.ingested;
      console.log(
        `Discord: ${discordResult.value.ingested} ingested, ${discordResult.value.skipped} skipped`
      );
    } else {
      console.error("Discord ingestion failed:", discordResult.reason);
    }

    // 4. Classify unclassified mentions
    const { data: unclassified } = await supabaseAdmin
      .from("mentions")
      .select("id, source, title, body, author, engagement_score, published_at")
      .is("classified_at", null)
      .order("published_at", { ascending: false })
      .limit(50);

    let classifiedCount = 0;
    if (unclassified && unclassified.length > 0) {
      const inputs: ClassificationInput[] = unclassified.map((m) => ({
        source: m.source,
        title: m.title ?? "",
        body: m.body ?? "",
        author: m.author ?? "",
        engagement_score: m.engagement_score,
        published_at: m.published_at,
      }));

      const outputs = await classifyBatch(inputs);

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
            tension_type: classification.tension_type,
            primary_emotion: classification.primary_emotion,
            topic: classification.topic,
            is_competitor_mention: classification.is_competitor_mention,
            competitor_names: classification.competitor_names,
            credibility_signal: classification.credibility_signal,
            topics: classification.topics,
            inferred_region: classification.inferred_region,
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
        }
      }
    }

    // 4.5 Propagation detection (needs classified mentions)
    try {
      const propagation = await detectPropagation();
      console.log(
        `Propagation: ${propagation.new_clusters} new, ${propagation.updated_clusters} updated, ${propagation.resolved_clusters} resolved`
      );
    } catch (e) {
      console.error("Propagation detection failed:", e);
    }

    // 5. Update velocity for recent mentions
    await updateEngagementSnapshots();

    // 6. Score press mentions for message pull-through (legacy key_messages)
    try {
      await scorePressmentions();
    } catch (e) {
      console.error("Pull-through scoring (legacy) failed:", e);
    }

    // 6.5 Score press mentions against narrative priorities (new dynamic scoring)
    try {
      await scorePressMentions();
    } catch (e) {
      console.error("Pull-through scoring (narrative priorities) failed:", e);
    }

    // 6.6 Profile journalists from press mentions
    try {
      await profileJournalists();
    } catch (e) {
      console.error("Journalist profiling failed:", e);
    }

    // 6.7 LLM Output Monitoring (6am PT = 13:00 UTC)
    const hour = new Date().getUTCHours();

    if (hour === 13) {
      try {
        const { data: activeProbes } = await supabaseAdmin
          .from("llm_probes")
          .select("id, prompt_text, category, frequency")
          .eq("is_active", true);

        if (activeProbes && activeProbes.length > 0) {
          const isMonday = new Date().getUTCDay() === 1;
          const todaysProbes = activeProbes.filter(
            (p: { frequency: string }) =>
              p.frequency === "daily" || (p.frequency === "weekly" && isMonday)
          );

          const platforms = (
            ["chatgpt", "gemini", "perplexity", "claude"] as const
          ).filter((p) => {
            if (p === "chatgpt") return !!process.env.OPENAI_API_KEY;
            if (p === "gemini") return !!process.env.GOOGLE_AI_API_KEY;
            if (p === "perplexity") return !!process.env.PERPLEXITY_API_KEY;
            if (p === "claude") return !!process.env.ANTHROPIC_API_KEY;
            return false;
          });

          if (todaysProbes.length > 0 && platforms.length > 0) {
            const fetchResults = await fetchLLMResponses(
              todaysProbes.map((p: { id: string; prompt_text: string }) => ({
                id: p.id,
                prompt_text: p.prompt_text,
              })),
              [...platforms]
            );

            for (const resp of fetchResults) {
              if (resp.response_text.startsWith("[ERROR]") || !resp.stored_id)
                continue;
              const probe = todaysProbes.find(
                (p: { id: string }) => p.id === resp.probe_id
              );
              try {
                await classifyLLMResponse({
                  id: resp.stored_id,
                  probe_id: resp.probe_id,
                  platform: resp.platform,
                  response_text: resp.response_text,
                  probe_prompt:
                    (probe as { prompt_text?: string })?.prompt_text ?? "",
                  probe_category:
                    (probe as { category?: string })?.category ?? "general",
                });
                await new Promise((r) => setTimeout(r, 500));
              } catch (e) {
                console.error(
                  `LLM classify error (${resp.platform}/${resp.probe_id}):`,
                  e
                );
              }
            }

            console.log(
              `[llm-monitor] ${fetchResults.length} responses fetched & classified`
            );
          }

          // Weekly snapshots on Monday
          if (isMonday) {
            try {
              const prevMonday = new Date(
                getMondayOfThisWeek().getTime() - 7 * 24 * 60 * 60 * 1000
              );
              await generateLLMSnapshots(prevMonday);
            } catch (e) {
              console.error("LLM snapshot generation failed:", e);
            }
          }
        }
      } catch (e) {
        console.error("LLM output monitoring failed:", e);
      }
    }

    // 7. Fire alerts for unreviewed fires in last 2 hours
    const { data: currentFires } = await supabaseAdmin
      .from("mentions")
      .select("*")
      .eq("urgency", "fire")
      .eq("is_reviewed", false)
      .gte(
        "published_at",
        new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      );

    if (currentFires && currentFires.length > 0) {
      await sendFireAlert(currentFires);
    }

    // 8. Morning brief at 7am PT (UTC 15:00)
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const host = request.headers.get("host") || "localhost:3000";
    const baseUrl = `${protocol}://${host}`;

    if (hour === 15) {
      await generateDailyBrief();

      // 8.5 Audience-specific briefs
      try {
        await fetch(`${baseUrl}/api/briefs/audience`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.CRON_SECRET}`,
          },
        });
        await fetch(`${baseUrl}/api/briefs/audience/deliver`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.CRON_SECRET}`,
          },
        });
      } catch (e) {
        console.error("Audience brief generation failed:", e);
      }

      // 8.6 Narrative gap detection (daily)
      try {
        await detectNarrativeGaps();
      } catch (e) {
        console.error("Narrative gap detection failed:", e);
      }

      // 8.7 Weekly tasks (Monday only)
      const dayOfWeek = new Date().getUTCDay();
      if (dayOfWeek === 1) {
        // Trigger narrative snapshot via API
        try {
          await fetch(`${baseUrl}/api/narratives/snapshots`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.CRON_SECRET}`,
            },
          });
        } catch (e) {
          console.error("Narrative snapshot failed:", e);
        }

        // Generate weekly narrative report
        try {
          const monday = getMondayOfThisWeek();
          await generateNarrativeReport(monday);
        } catch (e) {
          console.error("Narrative report generation failed:", e);
        }
      }
    }

    // 9. Process fire mentions into incidents (War Room)
    let incidentsCreated = 0;
    let incidentsLinked = 0;
    try {
      // Fetch fire mentions not yet linked to an incident
      const { data: fireMentions } = await supabaseAdmin
        .from("mentions")
        .select("id, title, body, source, urgency, topic, recommended_action, published_at")
        .eq("urgency", "fire")
        .not("classified_at", "is", null)
        .gte(
          "published_at",
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        )
        .order("published_at", { ascending: false })
        .limit(20);

      if (fireMentions && fireMentions.length > 0) {
        // Filter to only those without incident_mentions rows
        const fireIds = fireMentions.map((f: { id: string }) => f.id);
        const { data: alreadyLinked } = await supabaseAdmin
          .from("incident_mentions")
          .select("mention_id")
          .in("mention_id", fireIds);

        const linkedSet = new Set(
          (alreadyLinked || []).map((a: { mention_id: string }) => a.mention_id)
        );
        const toProcess = fireMentions.filter(
          (f: { id: string }) => !linkedSet.has(f.id)
        );

        for (const fire of toProcess) {
          try {
            const result = await processFireMention(fire);
            if (result.is_new) incidentsCreated++;
            else incidentsLinked++;
            console.log(
              `Fire processed: ${fire.title} → incident ${result.incident_id} (new: ${result.is_new})`
            );
            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (e) {
            console.error(
              `Incident processing failed for mention ${fire.id}:`,
              e
            );
          }
        }
      }
    } catch (e) {
      console.error("Incident processing step failed:", e);
    }

    // 10. Complete ingestion log
    const durationMs = Date.now() - startTime;
    if (log) {
      await supabaseAdmin
        .from("ingestion_logs")
        .update({
          completed_at: new Date().toISOString(),
          mentions_found: allMentions.length + twitterIngested + discordIngested,
          mentions_new: newCount + twitterIngested + discordIngested,
          mentions_classified: classifiedCount,
          duration_ms: durationMs,
        })
        .eq("id", log.id);
    }

    return NextResponse.json({
      success: true,
      mentions_found: allMentions.length,
      mentions_new: newCount,
      twitter_ingested: twitterIngested,
      discord_ingested: discordIngested,
      classified: classifiedCount,
      fires: currentFires?.length ?? 0,
      incidents_created: incidentsCreated,
      incidents_linked: incidentsLinked,
      duration_ms: durationMs,
    });
  } catch (error) {
    console.error("POST /api/cron error:", error);

    // Log failure
    if (log) {
      await supabaseAdmin
        .from("ingestion_logs")
        .update({
          completed_at: new Date().toISOString(),
          error: error instanceof Error ? error.message : "Unknown error",
          duration_ms: Date.now() - startTime,
        })
        .eq("id", log.id);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron job failed" },
      { status: 500 }
    );
  }
}
