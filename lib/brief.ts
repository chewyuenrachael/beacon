import { supabaseAdmin } from "./supabase";
import type { MentionRow } from "./types";

const NARRATIVE_LABELS: Record<string, string> = {
  "safety-alignment": "Safety",
  "developer-experience": "Dev experience",
  "enterprise-adoption": "Enterprise",
  "competitive-positioning": "Competitive",
  "pricing-access": "Pricing",
  "open-source-ecosystem": "Ecosystem",
  "regulation-policy": "Regulation",
};

const BRIEF_SYSTEM_PROMPT = `You are a communications intelligence analyst writing the daily morning brief for Anthropic's comms team. Your job is to synthesize overnight developer sentiment data into a concise, actionable brief.

Format rules:
- Start with exactly 3 bullet points as the executive summary. Each bullet should be one concise sentence. Format as:
  • First bullet: the single most urgent thing (or 'All clear' if no fires)
  • Second bullet: the overall community temperature
  • Third bullet: one thing worth celebrating or one emerging pattern
  CRITICAL: If there are any fire-urgency mentions listed in the data, the first executive summary bullet MUST reference them. Never say 'All clear' or 'Quiet day' if fires exist in the data. Always start with the most urgent items.
  Do not write a paragraph. Use the bullet character • directly (not markdown - or *). Keep each bullet under 20 words.
- Write in standard markdown (not Slack format). Use [text](url) for links, not <url|text>. Use ## for section headers. Use **bold** for emphasis.
- Stay under 600 words
- Link every item using [text](url) format
- Be direct and actionable — this is a working document, not a report
- For each item in the Act Now section, end the description paragraph, then on the NEXT LINE write 'Action:' followed by the specific recommended action. Example:
  **DoD Sabotage Allegations**: Wired reports the Department of Defense alleges Anthropic could manipulate AI models during wartime, with Reddit discussion gaining traction (21 engagements).
  Action: Immediate legal/PR coordination required for official response.
  The 'Action:' must be on its own line, not inline with the description.

Do NOT include a 'Act now' or fires section in the brief. Fires are rendered separately from structured data. Start the brief directly with the executive summary, then the sections below.

Structure the brief in exactly 2 sections plus a stats footer:

## ✨ Worth your attention
The top 5 items the comms team should know about today. Merge together: community moments (developer builds, testimonials, viral positive content), accelerating posts (gaining traction fast), and tension posts (developers expressing both hope and alarm). Sort by engagement or importance. If more than 5 items qualify, pick the top 5 and note 'N more in the full feed' at the end.

For each item, format as:

**Title goes here (type)**
Description text with [linked sources](url) and engagement count.

Put the title on its own line in bold. Put the description on the next line as regular text. Do NOT put them on the same line separated by a colon. Do NOT use any bullet characters, symbols, or prefixes before the title. No ✦, no ◇, no ◐, no ⚔, no •, no -. Just the bold title on its own line.

After each item title, on the same bold line, include a type tag in parentheses: (moment), (signal), (competitor), (tension), or (accelerating).

In description text, hyperlink the name of the tool, project, or source where it's most natural in the sentence. Do NOT create standalone 'Link' text. The link should be woven into the sentence on the most descriptive word or phrase.

Put engagement counts in parentheses at the end of the description, not as standalone text. Do NOT wrap engagement counts in links.

Example:

**Visual Code Communication Tool (moment)**
Software engineer built [Snip](https://reddit.com/r/ClaudeAI/...), an open-source annotation tool enabling bidirectional visual communication with Claude Code (45 engagements).

**Windows Compatibility Pain Points (signal)**
User experienced Claude Code crashes on Windows with [detailed reproduction steps](https://reddit.com/r/ClaudeAI/...) affecting multiple versions (12 engagements).

## 📡 On the radar
The top 3 patterns worth tracking. Merge together: signals (shifting sentiment, recurring requests, emerging narratives) and competitor moves. Use the same title-on-its-own-line format with (signal) or (competitor) type tags. If more than 3 items qualify, pick the top 3.

## 📊 By the numbers
One compact paragraph: total mentions, platform breakdown, sentiment quadrant split (high hope/low concern, etc). Include narrative theme distribution if topic data is provided. If one theme dominates (2x+ more mentions than the next), call it out (e.g., "Developer experience dominated today's coverage (15 of 22 mentions)"). If a topic has fires, always mention it. Keep this to 3-4 lines max.`;

interface QuadrantCounts {
  highHope_highConcern: number;
  highHope_lowConcern: number;
  lowHope_highConcern: number;
  lowHope_lowConcern: number;
}

function computeQuadrants(mentions: MentionRow[]): QuadrantCounts {
  const counts: QuadrantCounts = {
    highHope_highConcern: 0,
    highHope_lowConcern: 0,
    lowHope_highConcern: 0,
    lowHope_lowConcern: 0,
  };

  for (const m of mentions) {
    const highHope = (m.hope_score ?? 0) >= 2;
    const highConcern = (m.concern_score ?? 0) >= 2;

    if (highHope && highConcern) counts.highHope_highConcern++;
    else if (highHope) counts.highHope_lowConcern++;
    else if (highConcern) counts.lowHope_highConcern++;
    else counts.lowHope_lowConcern++;
  }

  return counts;
}

function computeTopSources(
  mentions: MentionRow[]
): { source: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const m of mentions) {
    counts[m.source] = (counts[m.source] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

function formatFireLine(m: MentionRow): string {
  const velocity =
    m.velocity_status === "accelerating"
      ? ` | ⚡ ${m.velocity_score?.toFixed(1)} pts/hr`
      : "";
  return `- [${m.source}] ${m.summary ?? m.title} (engagement: ${m.engagement_score ?? 0}${velocity}) ${m.source_url}\n  Action: ${m.recommended_action ?? "Review urgently"}`;
}

function formatPoolLine(m: MentionRow): string {
  const tag = m.velocity_status === "accelerating"
    ? "accelerating"
    : m.tension_type && m.tension_type !== "none"
      ? `tension/${m.tension_type}`
      : m.urgency ?? "signal";
  const competitors = m.is_competitor_mention
    ? ` | Competitors: ${(m.competitor_names ?? []).join(", ")}`
    : "";
  return `- [${tag}] [${m.source}] ${m.summary ?? m.title} (engagement: ${m.engagement_score ?? 0}) ${m.source_url}${competitors}`;
}

function buildBriefPrompt(
  fires: MentionRow[],
  accelerating: MentionRow[],
  moments: MentionRow[],
  tensions: MentionRow[],
  signals: MentionRow[],
  competitors: MentionRow[],
  mentionCount: number,
  quadrants: QuadrantCounts,
  topSources: { source: string; count: number }[],
  topicSummary: { topic: string; count: number; fires: number }[]
): string {
  const sections: string[] = [];

  sections.push("=== DATA FOR BRIEF ===\n");

  // Fires — details included so the executive summary can reference them
  if (fires.length > 0) {
    sections.push(`FIRES (${fires.length}) — these are rendered separately in the UI, so do not create a fires section, but you MUST reference them in the first executive summary bullet:`);
    for (const m of fires) sections.push(formatFireLine(m));
  } else {
    sections.push("FIRES: 0 — no active fires.");
  }

  // Worth Your Attention — pool of moments + accelerating + tensions
  const attentionPool = [
    ...moments.slice(0, 5),
    ...accelerating.slice(0, 3),
    ...tensions.slice(0, 3),
  ];
  sections.push(
    `\nWORTH YOUR ATTENTION — pool of ${moments.length} moments + ${accelerating.length} accelerating + ${tensions.length} tensions:`
  );
  if (attentionPool.length === 0) sections.push("Nothing notable today.");
  else for (const m of attentionPool) sections.push(formatPoolLine(m));

  // On the Radar — pool of signals + competitors
  const radarPool = [
    ...signals.slice(0, 5),
    ...competitors.slice(0, 3),
  ];
  sections.push(
    `\nON THE RADAR — pool of ${signals.length} signals + ${competitors.length} competitor mentions:`
  );
  if (radarPool.length === 0) sections.push("Nothing notable today.");
  else for (const m of radarPool) sections.push(formatPoolLine(m));

  // Stats
  const sourceSummary = topSources
    .slice(0, 5)
    .map((s) => `${s.source}: ${s.count}`)
    .join(", ");
  sections.push(
    `\nSTATS: Total: ${mentionCount} | Sources: ${sourceSummary} | Quadrants: High hope + high concern: ${quadrants.highHope_highConcern}, High hope + low concern: ${quadrants.highHope_lowConcern}, Low hope + high concern: ${quadrants.lowHope_highConcern}, Low hope + low concern: ${quadrants.lowHope_lowConcern}`
  );

  // Topic breakdown
  if (topicSummary.length > 0) {
    const topicLines = topicSummary
      .map(
        (t) =>
          `- ${NARRATIVE_LABELS[t.topic] || t.topic}: ${t.count} mentions${t.fires > 0 ? `, ${t.fires} fires` : ""}`
      )
      .join("\n");
    sections.push(`\nTOPIC BREAKDOWN:\n${topicLines}`);
  }

  sections.push(
    "\n=== END DATA ===\n\nSynthesize the above into the daily brief. Do NOT include a fires/Act now section. Use exactly these section headers: ## ✨ Worth your attention, ## 📡 On the radar, ## 📊 By the numbers. Use [text](url) for links. Keep it under 600 words."
  );

  return sections.join("\n");
}

export async function generateDailyBrief(): Promise<string> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Fetch fires separately to guarantee they are never missed
  const [firesRes, othersRes] = await Promise.all([
    supabaseAdmin
      .from("mentions")
      .select("*")
      .eq("urgency", "fire")
      .gte("published_at", since)
      .not("classified_at", "is", null),
    supabaseAdmin
      .from("mentions")
      .select("*")
      .neq("urgency", "fire")
      .gte("published_at", since)
      .not("classified_at", "is", null)
      .order("engagement_score", { ascending: false })
      .limit(200),
  ]);

  if (firesRes.error) {
    throw new Error(`Failed to fetch fires: ${firesRes.error.message}`);
  }
  if (othersRes.error) {
    throw new Error(`Failed to fetch mentions: ${othersRes.error.message}`);
  }

  const allMentions: MentionRow[] = [
    ...(firesRes.data ?? []),
    ...(othersRes.data ?? []),
  ];

  if (allMentions.length === 0) {
    const quietBrief =
      "*📋 Daily Brief*\n\nQuiet day — no classified mentions in the last 24 hours. Enjoy the calm.";

    const today = new Date().toISOString().split("T")[0];
    await supabaseAdmin.from("daily_briefs").upsert(
      {
        brief_date: today,
        full_brief: quietBrief,
        mention_count: 0,
        fire_count: 0,
        moment_count: 0,
        tension_count: 0,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "brief_date" }
    );

    return quietBrief;
  }

  // Segment
  const fires = allMentions.filter((m) => m.urgency === "fire");
  const moments = allMentions.filter((m) => m.urgency === "moment");
  const signals = allMentions.filter((m) => m.urgency === "signal");
  const competitors = allMentions.filter((m) => m.is_competitor_mention);
  const tensions = allMentions.filter(
    (m) => m.tension_type && m.tension_type !== "none"
  );
  const accelerating = allMentions.filter(
    (m) => m.velocity_status === "accelerating" && m.urgency !== "fire"
  );

  // Quadrants
  const quadrants = computeQuadrants(allMentions);

  // Top sources
  const topSources = computeTopSources(allMentions);

  // Topic breakdown
  const topicGroups: Record<string, MentionRow[]> = {};
  for (const m of allMentions) {
    if (m.topic) {
      if (!topicGroups[m.topic]) topicGroups[m.topic] = [];
      topicGroups[m.topic].push(m);
    }
  }
  const topicSummary = Object.entries(topicGroups)
    .map(([topic, items]) => ({
      topic,
      count: items.length,
      fires: items.filter((i) => i.urgency === "fire").length,
    }))
    .sort((a, b) => b.count - a.count);

  // Build prompt
  const userPrompt = buildBriefPrompt(
    fires,
    accelerating,
    moments,
    tensions,
    signals,
    competitors,
    allMentions.length,
    quadrants,
    topSources,
    topicSummary
  );

  // Call Claude Sonnet
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: BRIEF_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Claude API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const briefText: string = data.content[0].text;

  // Upsert into daily_briefs
  const today = new Date().toISOString().split("T")[0];

  await supabaseAdmin.from("daily_briefs").upsert(
    {
      brief_date: today,
      full_brief: briefText,
      mention_count: allMentions.length,
      fire_count: fires.length,
      moment_count: moments.length,
      tension_count: tensions.length,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "brief_date" }
  );

  return briefText;
}
