import { supabaseAdmin } from "@/lib/supabase";

export async function generateLLMSnapshots(weekStart: Date): Promise<void> {
  const weekStartStr = weekStart.toISOString().split("T")[0];
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const weekEndStr = weekEnd.toISOString().split("T")[0];

  // Fetch all responses in the date range
  const { data: responses, error: respError } = await supabaseAdmin
    .from("llm_responses")
    .select("id, probe_id, platform, response_date")
    .gte("response_date", weekStartStr)
    .lt("response_date", weekEndStr);

  if (respError) {
    console.error("[llm-snapshots] Failed to fetch responses:", respError);
    return;
  }

  if (!responses || responses.length === 0) {
    console.log("[llm-snapshots] No responses found for week", weekStartStr);
    return;
  }

  // Fetch all classifications for these responses
  const responseIds = responses.map((r) => r.id);
  const { data: classifications, error: classError } = await supabaseAdmin
    .from("llm_response_classifications")
    .select("*")
    .in("response_id", responseIds);

  if (classError) {
    console.error("[llm-snapshots] Failed to fetch classifications:", classError);
    return;
  }

  // Group by platform
  const classMap = new Map<string, Record<string, unknown>[]>();
  const responsesByPlatform = new Map<string, number>();

  for (const resp of responses) {
    responsesByPlatform.set(
      resp.platform,
      (responsesByPlatform.get(resp.platform) || 0) + 1
    );
  }

  // Map classifications to their response's platform
  const responseIdToPlatform = new Map<string, string>();
  for (const resp of responses) {
    responseIdToPlatform.set(resp.id, resp.platform);
  }

  for (const cls of classifications || []) {
    const platform = responseIdToPlatform.get(cls.response_id);
    if (!platform) continue;
    if (!classMap.has(platform)) classMap.set(platform, []);
    classMap.get(platform)!.push(cls);
  }

  // Compute aggregates per platform
  let snapshotsCreated = 0;

  for (const [platform, platformClassifications] of classMap.entries()) {
    const totalResponses = responsesByPlatform.get(platform) || 0;
    const totalClassified = platformClassifications.length;

    // Mention rate: fraction where anthropic or claude is mentioned
    const mentioned = platformClassifications.filter(
      (c) => c.anthropic_mentioned || c.claude_mentioned
    ).length;
    const mentionRate = totalClassified > 0 ? mentioned / totalClassified : 0;

    // Average sentiment (only where mentioned)
    const mentionedClassifications = platformClassifications.filter(
      (c) => c.anthropic_mentioned || c.claude_mentioned
    );
    const avgSentiment =
      mentionedClassifications.length > 0
        ? mentionedClassifications.reduce(
            (sum, c) => sum + (Number(c.mention_sentiment) || 0),
            0
          ) / mentionedClassifications.length
        : 0;

    // Average rank (only where non-null)
    const rankedClassifications = platformClassifications.filter(
      (c) => c.anthropic_rank != null
    );
    const avgRank =
      rankedClassifications.length > 0
        ? rankedClassifications.reduce(
            (sum, c) => sum + (Number(c.anthropic_rank) || 0),
            0
          ) / rankedClassifications.length
        : null;

    // Average overall score
    const avgOverallScore =
      totalClassified > 0
        ? platformClassifications.reduce(
            (sum, c) => sum + (Number(c.overall_score) || 0),
            0
          ) / totalClassified
        : 0;

    // Narrative pull-through: for each narrative, fraction where present
    const narrativeCounts: Record<string, { present: number; total: number }> =
      {};
    for (const cls of platformClassifications) {
      const narratives = cls.narratives_reflected as
        | { slug: string; present: boolean }[]
        | null;
      if (!Array.isArray(narratives)) continue;
      for (const n of narratives) {
        if (!narrativeCounts[n.slug]) {
          narrativeCounts[n.slug] = { present: 0, total: 0 };
        }
        narrativeCounts[n.slug].total++;
        if (n.present) narrativeCounts[n.slug].present++;
      }
    }
    const narrativePullThrough: Record<string, number> = {};
    for (const [slug, counts] of Object.entries(narrativeCounts)) {
      narrativePullThrough[slug] =
        counts.total > 0 ? counts.present / counts.total : 0;
    }

    // Top competitor: most frequently mentioned across all classifications
    const competitorCounts: Record<string, number> = {};
    for (const cls of platformClassifications) {
      const competitors = cls.competitors_mentioned as
        | { name: string }[]
        | null;
      if (!Array.isArray(competitors)) continue;
      for (const comp of competitors) {
        competitorCounts[comp.name] =
          (competitorCounts[comp.name] || 0) + 1;
      }
    }
    const topCompetitor =
      Object.entries(competitorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      null;

    // Error counts
    let errorCount = 0;
    let factualErrorCount = 0;
    let criticalErrorCount = 0;
    for (const cls of platformClassifications) {
      const errors = cls.factual_errors as { severity: string }[] | null;
      if (Array.isArray(errors) && errors.length > 0) {
        errorCount++;
        factualErrorCount += errors.length;
        criticalErrorCount += errors.filter(
          (e) => e.severity === "critical"
        ).length;
      }
      if (cls.has_critical_error) criticalErrorCount = Math.max(criticalErrorCount, 1);
    }

    // Upsert snapshot
    const { error: upsertError } = await supabaseAdmin
      .from("llm_monitoring_snapshots")
      .upsert(
        {
          platform,
          week_start: weekStartStr,
          total_responses: totalResponses,
          anthropic_mention_rate: Math.round(mentionRate * 1000) / 1000,
          avg_sentiment: Math.round(avgSentiment * 100) / 100,
          avg_rank: avgRank != null ? Math.round(avgRank * 10) / 10 : null,
          avg_overall_score: Math.round(avgOverallScore * 100) / 100,
          narrative_pull_through: narrativePullThrough,
          top_competitor: topCompetitor,
          error_count: errorCount,
          factual_error_count: factualErrorCount,
          critical_error_count: criticalErrorCount,
          snapshot_at: new Date().toISOString(),
        },
        { onConflict: "platform,week_start" }
      );

    if (upsertError) {
      console.error(
        `[llm-snapshots] Failed to upsert snapshot for ${platform}:`,
        upsertError
      );
    } else {
      snapshotsCreated++;
    }
  }

  console.log(
    `[llm-snapshots] Generated ${snapshotsCreated} snapshots for week ${weekStartStr}`
  );
}
