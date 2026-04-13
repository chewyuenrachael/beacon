import { supabaseAdmin } from "@/lib/supabase";

function normalizeTheme(theme: string): string {
  return theme.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

export async function detectNarrativeGaps(): Promise<{
  new_gaps: number;
  updated_gaps: number;
}> {
  // 1. Fetch last 7 days of community mentions (moment/signal only)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: mentions, error: mentionError } = await supabaseAdmin
    .from("mentions")
    .select("id, title, summary, source, urgency, topic, published_at")
    .in("source", ["hackernews", "reddit"])
    .in("urgency", ["moment", "signal"])
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(100);

  if (mentionError || !mentions || mentions.length < 3) {
    return { new_gaps: 0, updated_gaps: 0 };
  }

  // 2. Fetch active narrative priorities
  const { data: narratives } = await supabaseAdmin
    .from("narrative_priorities")
    .select("slug, display_name, description")
    .eq("is_active", true);

  const activeNarratives = narratives || [];

  // 3. Format mentions for the prompt
  const formattedMentions = mentions
    .map(
      (m, i) =>
        `[${i}] (${m.source}, ${m.urgency}) ${m.title || "Untitled"}: ${m.summary || ""}`
    )
    .join("\n");

  const systemPrompt = `You are a strategic communications analyst. Given a batch of developer community posts about AI tools, identify emerging narratives or themes that are NOT covered by the company's current narrative priorities.

An "emerging narrative" is a recurring theme that appears in 3+ posts and represents either:
- A new opportunity the comms team should consider adopting
- A new risk the comms team should prepare a counter-narrative for
- A market shift that changes how existing narratives should be framed

CURRENT NARRATIVE PRIORITIES (do NOT flag these — they're already tracked):
${activeNarratives.map((n) => `- ${n.display_name}: ${n.description}`).join("\n")}

COMMUNITY MENTIONS (last 7 days):
${formattedMentions}

Return JSON only:
{
  "gaps": [
    {
      "theme": "short name for the emerging narrative (3-6 words)",
      "description": "2-3 sentences: what's happening, how many posts reference it, why it matters for comms strategy",
      "mention_indices": [0, 3, 7],
      "recommendation": "adopt" | "counter" | "monitor",
      "recommendation_reason": "1 sentence: why this action"
    }
  ]
}

If no gaps are detected, return { "gaps": [] }.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: "Analyze these community mentions and identify narrative gaps.",
        },
        { role: "assistant", content: "{" },
      ],
    }),
  });

  const data = await response.json();

  if (data.error || !data.content || !data.content[0]) {
    console.error("Gap detection API error:", data.error);
    return { new_gaps: 0, updated_gaps: 0 };
  }

  const rawText = "{" + data.content[0].text;
  let cleaned = rawText
    .replace(/^```json\s*\n?/gm, "")
    .replace(/\n?```\s*$/gm, "")
    .replace(/```/g, "")
    .trim();

  let gaps: {
    theme: string;
    description: string;
    mention_indices: number[];
    recommendation: string;
    recommendation_reason: string;
  }[];

  try {
    const parsed = JSON.parse(cleaned);
    gaps = parsed.gaps || [];
  } catch (e) {
    console.error("Gap detection parse error:", e);
    return { new_gaps: 0, updated_gaps: 0 };
  }

  // 4. Process each gap
  let new_gaps = 0;
  let updated_gaps = 0;

  // Fetch existing gaps for fuzzy matching
  const { data: existingGaps } = await supabaseAdmin
    .from("narrative_gaps")
    .select("id, detected_theme, mention_count, sample_mention_ids");

  const existingNormalized = (existingGaps || []).map((g) => ({
    ...g,
    normalized: normalizeTheme(g.detected_theme),
  }));

  for (const gap of gaps) {
    const normalized = normalizeTheme(gap.theme);
    const sampleIds = gap.mention_indices
      .filter((i) => i >= 0 && i < mentions.length)
      .map((i) => mentions[i].id)
      .slice(0, 5);

    // Fuzzy match: check if any existing gap's normalized theme is a substring or vice versa
    const match = existingNormalized.find(
      (eg) =>
        eg.normalized === normalized ||
        eg.normalized.includes(normalized) ||
        normalized.includes(eg.normalized)
    );

    if (match) {
      // Update existing gap
      const existingSampleIds: string[] = match.sample_mention_ids || [];
      const mergedIds = [...new Set([...existingSampleIds, ...sampleIds])].slice(0, 5);

      await supabaseAdmin
        .from("narrative_gaps")
        .update({
          mention_count: (match.mention_count || 0) + sampleIds.length,
          last_seen_at: new Date().toISOString(),
          sample_mention_ids: mergedIds,
          description: gap.description,
          recommendation: gap.recommendation,
        })
        .eq("id", match.id);
      updated_gaps++;
    } else {
      // Insert new gap
      const { error: insertError } = await supabaseAdmin
        .from("narrative_gaps")
        .insert({
          detected_theme: gap.theme,
          description: gap.description,
          recommendation: gap.recommendation,
          recommendation_reason: gap.recommendation_reason,
          status: "new",
          mention_count: sampleIds.length,
          sample_mention_ids: sampleIds,
          last_seen_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("Failed to insert narrative gap:", insertError);
      } else {
        new_gaps++;
      }
    }
  }

  return { new_gaps, updated_gaps };
}
