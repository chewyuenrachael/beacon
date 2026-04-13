import { supabaseAdmin } from "@/lib/supabase";

interface NarrativeSnapshot {
  narrative_slug: string;
  display_name: string;
  pull_through_rate: number;
  pull_through_count: number;
  scored_mentions: number;
  gain_count: number;
  loss_count: number;
  neutral_count: number;
  target_pull_through?: number;
}

export async function generateNarrativeReport(
  weekStart: Date | string
): Promise<{ full_report: string; highlights: object }> {
  const ws = typeof weekStart === "string" ? new Date(weekStart) : weekStart;
  const weekLabel = ws.toISOString().split("T")[0];
  const prevWeekDate = new Date(ws.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prevWeekLabel = prevWeekDate.toISOString().split("T")[0];

  // Timestamp ranges still needed for journalist activity queries
  const weekStartISO = ws.toISOString();
  const weekEnd = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Fetch narrative snapshots for this week and previous week by week_start
  const { data: currentSnapshots } = await supabaseAdmin
    .from("narrative_snapshots")
    .select("*")
    .eq("week_start", weekLabel)
    .order("snapshot_at", { ascending: false });

  const { data: prevSnapshots } = await supabaseAdmin
    .from("narrative_snapshots")
    .select("*")
    .eq("week_start", prevWeekLabel)
    .order("snapshot_at", { ascending: false });

  // Deduplicate by narrative_slug (take most recent per slug)
  const currentBySlug = dedupeBySlug(currentSnapshots || []);
  const prevBySlug = dedupeBySlug(prevSnapshots || []);

  // 2. Fetch active narrative gaps
  const { data: gaps } = await supabaseAdmin
    .from("narrative_gaps")
    .select("*")
    .in("status", ["new", "reviewing"])
    .order("mention_count", { ascending: false })
    .limit(10);

  // 3. Fetch top journalist activities this week
  const { data: journalistActivity } = await supabaseAdmin
    .from("journalist_mentions")
    .select("journalist_id, mention_id")
    .gte("created_at", weekStartISO)
    .lt("created_at", weekEnd);

  // Count mentions per journalist
  const journalistCounts = new Map<string, number>();
  for (const ja of journalistActivity || []) {
    journalistCounts.set(
      ja.journalist_id,
      (journalistCounts.get(ja.journalist_id) || 0) + 1
    );
  }

  // Fetch top journalist profiles
  const topJournalistIds = Array.from(journalistCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  let topJournalists: { name: string; outlet: string; mention_count: number }[] = [];
  if (topJournalistIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("journalist_profiles")
      .select("id, name, outlet")
      .in("id", topJournalistIds);

    topJournalists = (profiles || []).map((p) => ({
      name: p.name,
      outlet: p.outlet,
      mention_count: journalistCounts.get(p.id) || 0,
    }));
  }

  // 4. Compute deltas
  const narrativeData = Object.entries(currentBySlug).map(([slug, current]) => {
    const prev = prevBySlug[slug];
    const currentRate = current.pull_through_rate || 0;
    const prevRate = prev?.pull_through_rate || 0;
    const delta = Math.round((currentRate - prevRate) * 100);

    return {
      display_name: current.display_name || slug,
      slug,
      currentRate: Math.round(currentRate * 100),
      prevRate: Math.round(prevRate * 100),
      delta,
      pullThroughCount: current.pull_through_count || 0,
      scoredMentions: current.scored_mentions || 0,
      gainCount: current.gain_count || 0,
      lossCount: current.loss_count || 0,
      neutralCount: current.neutral_count || 0,
    };
  });

  if (narrativeData.length === 0 && (!gaps || gaps.length === 0)) {
    return {
      full_report: "Insufficient data for weekly narrative report.",
      highlights: { winners: [], losers: [], gaps: [] },
    };
  }

  // 5. Generate report with Claude

  const narrativeSection = narrativeData
    .map(
      (n) => `${n.display_name}:
  This week: ${n.currentRate}% (${n.pullThroughCount}/${n.scoredMentions} articles)
  Last week: ${n.prevRate}%
  Delta: ${n.delta > 0 ? "+" : ""}${n.delta}pp
  Framing: ${n.gainCount} gain / ${n.lossCount} loss / ${n.neutralCount} neutral`
    )
    .join("\n\n");

  const gapSection =
    gaps && gaps.length > 0
      ? gaps
          .map(
            (g) =>
              `- "${g.detected_theme}": ${g.description} (${g.mention_count} mentions, recommendation: ${g.recommendation})`
          )
          .join("\n")
      : "No new narrative gaps detected this week.";

  const journalistSection =
    topJournalists.length > 0
      ? topJournalists
          .map(
            (j) =>
              `- ${j.name} (${j.outlet}): ${j.mention_count} articles this week`
          )
          .join("\n")
      : "No journalist activity tracked this week.";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: `You are the Head of Communications Analytics at a frontier AI company. Write a weekly narrative intelligence report for the CCO. Be specific, use numbers, name journalists and outlets, and always end each section with a recommended action.

Tone: sharp, direct, no corporate fluff. Think internal strategy memo, not external report.`,
      messages: [
        {
          role: "user",
          content: `Week of ${weekLabel} — Narrative Intelligence Report

PULL-THROUGH PERFORMANCE:
${narrativeSection}

EMERGING NARRATIVES (from community monitoring):
${gapSection}

JOURNALIST HIGHLIGHTS:
${journalistSection}

Generate the report with these sections:
## Executive Summary (3 bullets max)
## Winners (narratives gaining — what's working and why)
## Losers (narratives losing — what's failing and what to do)
## Journalist Intelligence (who's aligned, who's drifting, who's new)
## Emerging Narratives (gaps detected — adopt, counter, or monitor?)
## Recommended Actions (numbered list, max 5, each with owner and deadline)`,
        },
      ],
    }),
  });

  const data = await response.json();

  if (data.error || !data.content || !data.content[0]) {
    console.error("Report generation error:", data.error);
    return {
      full_report: "Failed to generate narrative report.",
      highlights: { winners: [], losers: [], gaps: [] },
    };
  }

  const fullReport = data.content[0].text;

  // 6. Extract structured highlights
  const winners = narrativeData.filter((n) => n.delta > 0);
  const losers = narrativeData.filter((n) => n.delta < 0 || n.currentRate < 30);
  const activeGaps = (gaps || []).map((g) => ({
    theme: g.detected_theme,
    recommendation: g.recommendation,
    mention_count: g.mention_count,
  }));

  const highlights = { winners, losers, gaps: activeGaps };

  // 7. Store the report
  const { error: storeError } = await supabaseAdmin
    .from("narrative_reports")
    .upsert(
      {
        week_start: weekLabel,
        full_report: fullReport,
        highlights,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "week_start" }
    );

  if (storeError) {
    console.error("Failed to store narrative report:", storeError);
  }

  return { full_report: fullReport, highlights };
}

function dedupeBySlug(
  snapshots: NarrativeSnapshot[]
): Record<string, NarrativeSnapshot> {
  const result: Record<string, NarrativeSnapshot> = {};
  for (const s of snapshots) {
    if (!result[s.narrative_slug]) {
      result[s.narrative_slug] = s;
    }
  }
  return result;
}
