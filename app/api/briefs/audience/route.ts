import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Audience, MentionRow } from "@/lib/types";

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatMention(m: MentionRow): string {
  const urgency = (m.urgency || "noise").toUpperCase();
  const tension = m.tension_type && m.tension_type !== "none"
    ? `, tension: ${m.tension_type}`
    : "";
  const topic = m.topic ? `, topic: ${m.topic}` : "";
  const action = m.recommended_action
    ? `\n  Action: ${m.recommended_action}`
    : "";

  return `[${urgency}] [${m.source}] ${m.title || "Untitled"} — ${m.summary || "No summary"} (engagement: ${m.engagement_score ?? 0}, hope: ${m.hope_score ?? 0}, concern: ${m.concern_score ?? 0}${tension}${topic})${action}`;
}

function defaultSystemPrompt(displayName: string): string {
  return `You are an intelligence analyst writing a daily brief for the ${displayName} team at Anthropic. Synthesize the provided mentions into a concise, actionable brief tailored to this team's priorities. Use markdown formatting. Be direct — this is a working document, not a report.`;
}

async function fetchPullthroughSummary(): Promise<string | null> {
  try {
    const { data: messages } = await supabaseAdmin
      .from("key_messages")
      .select("shorthand")
      .eq("is_active", true);

    if (!messages || messages.length === 0) return null;

    const { data: scores } = await supabaseAdmin
      .from("pullthrough_scores")
      .select("message_id, score");

    if (!scores || scores.length === 0) return null;

    const { data: allMessages } = await supabaseAdmin
      .from("key_messages")
      .select("id, shorthand")
      .eq("is_active", true);

    if (!allMessages) return null;

    const messageMap = new Map(allMessages.map(m => [m.id, m.shorthand]));
    const totalMentions = new Set(scores.map(s => s.message_id)).size;

    const stats: Record<string, { total: number; landed: number }> = {};
    for (const s of scores) {
      const shorthand = messageMap.get(s.message_id);
      if (!shorthand) continue;
      if (!stats[shorthand]) stats[shorthand] = { total: 0, landed: 0 };
      stats[shorthand].total++;
      if (s.score > 0) stats[shorthand].landed++;
    }

    const lines = Object.entries(stats)
      .map(([name, s]) => {
        const rate = s.total > 0 ? Math.round((s.landed / s.total) * 100) : 0;
        return `- ${name}: ${rate}% pull-through (${s.landed}/${s.total})`;
      })
      .join("\n");

    return `\nNARRATIVE PULL-THROUGH (${totalMentions} press articles scored):\n${lines}`;
  } catch {
    return null;
  }
}

async function getMentionsForAudience(
  audience: Audience,
  since: string
): Promise<MentionRow[]> {
  if (audience.slug === "comms") {
    // Comms sees everything
    const { data, error } = await supabaseAdmin
      .from("mentions")
      .select("*")
      .gte("published_at", since)
      .not("classified_at", "is", null)
      .order("engagement_score", { ascending: false })
      .limit(200);

    if (error) throw error;
    return data || [];
  }

  // Other audiences: routed mentions + all fires
  const [routedRes, firesRes] = await Promise.all([
    supabaseAdmin
      .from("mention_audience_routes")
      .select("mention_id")
      .eq("audience_slug", audience.slug),
    supabaseAdmin
      .from("mentions")
      .select("*")
      .eq("urgency", "fire")
      .gte("published_at", since)
      .not("classified_at", "is", null),
  ]);

  if (routedRes.error) throw routedRes.error;
  if (firesRes.error) throw firesRes.error;

  const routedIds = (routedRes.data || []).map(r => r.mention_id);
  const fires = firesRes.data || [];

  let routedMentions: MentionRow[] = [];
  if (routedIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("mentions")
      .select("*")
      .in("id", routedIds.slice(0, 50))
      .gte("published_at", since)
      .not("classified_at", "is", null);

    if (error) throw error;
    routedMentions = data || [];
  }

  // Merge and deduplicate
  const seen = new Set<string>();
  const merged: MentionRow[] = [];

  for (const m of [...fires, ...routedMentions]) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      merged.push(m);
    }
  }

  return merged;
}

async function generateBriefForAudience(
  audience: Audience,
  mentions: MentionRow[],
  today: string
): Promise<string> {
  const fires = mentions.filter(m => m.urgency === "fire");

  // Sort: fires first, then by engagement
  const sorted = [
    ...fires,
    ...mentions.filter(m => m.urgency !== "fire")
      .sort((a, b) => (b.engagement_score ?? 0) - (a.engagement_score ?? 0)),
  ];

  const sourceCounts: Record<string, number> = {};
  for (const m of mentions) {
    sourceCounts[m.source] = (sourceCounts[m.source] || 0) + 1;
  }
  const sourceBreakdown = Object.entries(sourceCounts)
    .map(([s, c]) => `${s}: ${c}`)
    .join(", ");

  const formattedMentions = sorted.slice(0, 50).map(formatMention).join("\n\n");

  let briefPrompt = `Generate a daily intelligence brief for the ${audience.display_name} team.

Date: ${today}
Mentions routed to this audience: ${mentions.length}
Fires: ${fires.length}
Sources: ${sourceBreakdown}

MENTIONS:
${formattedMentions}

Structure the brief as:

## 🔥 Act Now (fires only — skip this section if no fires)
For each fire: what happened, why it matters to THIS team specifically, recommended action.

## 👀 Worth Your Attention
Top 5-8 mentions by relevance to this team. Each: one-line summary, why this team cares, suggested action.

## 📊 Quick Stats
- Total mentions: ${mentions.length}
- Sources breakdown
- Dominant topics
- Sentiment snapshot (hope vs concern trend)

## 💡 So What
2-3 sentence synthesis: what's the overall signal for this team today? What should they prioritize?`;

  // For comms: append pull-through data
  if (audience.slug === "comms") {
    const ptSummary = await fetchPullthroughSummary();
    if (ptSummary) {
      briefPrompt += `\n\n${ptSummary}\n\nInclude a brief pull-through summary in the Quick Stats section.`;
    }
  }

  const systemPrompt = audience.brief_prompt_context || defaultSystemPrompt(audience.display_name);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: briefPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

export async function POST(request: Request) {
  try {
    const { data: audiences, error: audError } = await supabaseAdmin
      .from("audiences")
      .select("*")
      .eq("is_active", true)
      .order("display_name");

    if (audError) throw audError;
    if (!audiences || audiences.length === 0) {
      return NextResponse.json({ generated: 0, skipped: 0, audiences: [] });
    }

    let today: string;
    try { const body = await request.json(); today = body?.date || new Date().toISOString().split("T")[0]; }
    catch { today = new Date().toISOString().split("T")[0]; }

    const targetDate = new Date(today + "T00:00:00Z");
    const since = new Date(targetDate.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const until = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000).toISOString();

    let generated = 0;
    let skipped = 0;
    const generatedAudiences: string[] = [];

    console.log("[BRIEF DEBUG] today:", today, "since:", since, "until:", until);
    for (const audience of audiences as Audience[]) {
      try {
        const mentions = await getMentionsForAudience(audience, since);
        console.log(`[BRIEF] ${audience.slug}: ${mentions.length} mentions found, since=${since}`);

        let briefText: string;

        if (audience.slug !== "comms" && mentions.length < 2) {
          briefText = `No significant intelligence for ${audience.display_name} today.`;
          skipped++;
        } else {
          briefText = await generateBriefForAudience(audience, mentions, today);
          generated++;
          generatedAudiences.push(audience.slug);
        }

        const fires = mentions.filter(m => m.urgency === "fire");

        await supabaseAdmin.from("audience_briefs").upsert(
          {
            audience_slug: audience.slug,
            brief_date: today,
            full_brief: briefText,
            mention_count: mentions.length,
            fire_count: fires.length,
            generated_at: new Date().toISOString(),
          },
          { onConflict: "audience_slug,brief_date" }
        );

        // Rate limit: space out Claude API calls
        await delay(500);
      } catch (err) {
        console.error(`Brief generation failed for ${audience.slug}:`, err);
        skipped++;
      }
    }

    return NextResponse.json({ generated, skipped, audiences: generatedAudiences });
  } catch (error) {
    console.error("POST /api/briefs/audience error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Brief generation failed" },
      { status: 500 }
    );
  }
}
