// ============================================================
// Post-Incident Analyzer — generates post-mortem reviews
// ============================================================

import { supabaseAdmin } from "@/lib/supabase-admin";

export interface PostIncidentReview {
  what_happened: string;
  what_went_well: string[];
  what_went_wrong: string[];
  action_items: {
    action: string;
    owner: string;
    deadline: string;
    status: string;
  }[];
  response_time_assessment: string;
  narrative_outcome: string;
  template_effectiveness: string;
}

interface TimelineEvent {
  timestamp: string;
  event: string;
}

export async function generatePostIncidentReview(
  incidentId: string
): Promise<PostIncidentReview> {
  // 1. Fetch the full incident
  const { data: incident, error: incidentError } = await supabaseAdmin
    .from("incidents")
    .select("*")
    .eq("id", incidentId)
    .single();

  if (incidentError || !incident) {
    throw new Error(
      `Incident not found: ${incidentId} — ${incidentError?.message}`
    );
  }

  // 2. Fetch linked mentions
  const { data: incidentMentions } = await supabaseAdmin
    .from("incident_mentions")
    .select("mention_id")
    .eq("incident_id", incidentId);

  const mentionIds = (incidentMentions || []).map(
    (im: { mention_id: string }) => im.mention_id
  );

  let mentions: {
    id: string;
    source: string;
    title: string | null;
    body: string | null;
    summary: string | null;
    engagement_score: number;
    published_at: string;
    source_url: string;
  }[] = [];

  if (mentionIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("mentions")
      .select(
        "id, source, title, body, summary, engagement_score, published_at, source_url"
      )
      .in("id", mentionIds)
      .order("published_at", { ascending: true });
    mentions = data || [];
  }

  // 3. Fetch response drafts
  const { data: drafts } = await supabaseAdmin
    .from("response_drafts")
    .select("*")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: true });

  // 4. Fetch stakeholder checklists
  const { data: checklists } = await supabaseAdmin
    .from("stakeholder_checklists")
    .select("*")
    .eq("incident_id", incidentId);

  // 5. Calculate metrics
  const responseTimeMinutes =
    incident.first_detected_at && incident.resolved_at
      ? Math.round(
          (new Date(incident.resolved_at).getTime() -
            new Date(incident.first_detected_at).getTime()) /
            60000
        )
      : null;

  const firstDraft = (drafts || [])[0];
  const minutesToFirstDraft =
    incident.first_detected_at && firstDraft?.created_at
      ? Math.round(
          (new Date(firstDraft.created_at).getTime() -
            new Date(incident.first_detected_at).getTime()) /
            60000
        )
      : null;

  const approvedDraft = (drafts || []).find(
    (d: { status: string }) => d.status === "approved"
  );
  const minutesToApproval =
    incident.first_detected_at && approvedDraft?.approved_at
      ? Math.round(
          (new Date(approvedDraft.approved_at).getTime() -
            new Date(incident.first_detected_at).getTime()) /
            60000
        )
      : null;

  const totalStakeholders = (checklists || []).length;
  const notifiedStakeholders = (checklists || []).filter(
    (c: { is_notified: boolean }) => c.is_notified
  ).length;

  const platforms = [...new Set(mentions.map((m) => m.source))];
  const peakEngagement = mentions.reduce(
    (max, m) => Math.max(max, m.engagement_score || 0),
    0
  );
  const totalEngagement = mentions.reduce(
    (sum, m) => sum + (m.engagement_score || 0),
    0
  );

  // 6. Build chronological timeline
  const timeline: TimelineEvent[] = [];

  for (const m of mentions) {
    timeline.push({
      timestamp: m.published_at,
      event: `[${m.source}] ${m.summary || m.title || "Mention detected"} (engagement: ${m.engagement_score})`,
    });
  }

  if (incident.created_at) {
    timeline.push({
      timestamp: incident.created_at,
      event: "Incident created in Beacon",
    });
  }

  for (const d of drafts || []) {
    timeline.push({
      timestamp: d.created_at,
      event: `Response draft created: ${d.title || d.channel || "untitled"} (status: ${d.status})`,
    });
  }

  if (incident.resolved_at) {
    timeline.push({
      timestamp: incident.resolved_at,
      event: "Incident marked resolved",
    });
  }

  timeline.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const chronologicalTimeline = timeline
    .map((t) => `${t.timestamp}: ${t.event}`)
    .join("\n");

  // 7. Fetch narrative pull-through data from incident period
  let narrativeContext = "";
  if (incident.first_detected_at && mentionIds.length > 0) {
    const { data: pullThrough } = await supabaseAdmin
      .from("mention_pull_through")
      .select("narrative_slug, score, framing")
      .in("mention_id", mentionIds);

    if (pullThrough && pullThrough.length > 0) {
      narrativeContext = pullThrough
        .map(
          (pt: { narrative_slug: string; score: number; framing: string }) =>
            `${pt.narrative_slug}: score=${pt.score}, framing=${pt.framing}`
        )
        .join("; ");
    }
  }

  // 8. Build draft summaries
  const draftSummaries = (drafts || [])
    .map(
      (d: { channel?: string; title?: string; status: string }) =>
        `[${d.channel || "unknown"}] ${d.title || "Untitled"} — ${d.status}`
    )
    .join("\n");

  // 9. Call Claude for analysis
  const userPrompt = `Incident: ${incident.title}
Type: ${incident.incident_type}
Severity: ${incident.severity}
Duration: ${incident.first_detected_at} to ${incident.resolved_at || "ongoing"} (${responseTimeMinutes != null ? `${responseTimeMinutes} min` : "unknown"})

TIMELINE:
${chronologicalTimeline}

METRICS:
- First detected: ${incident.first_detected_at}
- First draft created: ${firstDraft?.created_at || "N/A"} (${minutesToFirstDraft != null ? `${minutesToFirstDraft} min after detection` : "N/A"})
- First draft approved: ${approvedDraft?.approved_at || "N/A"} (${minutesToApproval != null ? `${minutesToApproval} min after detection` : "N/A"})
- Resolution: ${incident.resolved_at || "N/A"} (${responseTimeMinutes != null ? `${responseTimeMinutes} min total` : "N/A"})
- Stakeholders notified: ${notifiedStakeholders}/${totalStakeholders}
- Platforms affected: ${platforms.join(", ") || "none"}
- Peak engagement: ${peakEngagement}
- Total engagement: ${totalEngagement}
- Mentions: ${mentions.length}
${narrativeContext ? `- Narrative pull-through: ${narrativeContext}` : ""}

RESPONSE DRAFTS USED:
${draftSummaries || "None"}

RESOLUTION:
${incident.resolution_summary || "No resolution summary provided"}

Generate a post-incident review with:
1. what_happened: 2-3 sentence factual summary
2. what_went_well: bullet points of what worked
3. what_went_wrong: bullet points of what didn't work or was too slow
4. action_items: JSON array of { action, owner (role, not name), deadline (relative, e.g. "1 week"), status: "open" }
5. response_time_assessment: "fast" (<30 min first draft), "adequate" (30-90 min), "slow" (>90 min)
6. narrative_outcome: did we control the narrative? 2-3 sentences.
7. template_effectiveness: was the auto-generated draft useful? what should change?

Return as JSON.`;

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
      system: `You are a communications operations analyst conducting a post-incident
review. Be constructive and specific. Focus on what can be improved
for next time.`,
      messages: [
        { role: "user", content: userPrompt },
        { role: "assistant", content: "{" },
      ],
    }),
  });

  const data = await response.json();

  if (data.error) {
    console.error("Claude API error in post-incident analyzer:", data.error);
    throw new Error(
      `Post-incident analysis failed: ${data.error.message || JSON.stringify(data.error)}`
    );
  }

  if (!data.content || !data.content[0]) {
    throw new Error("Empty response from Claude during post-incident analysis");
  }

  // 10. Parse JSON response (prepend the { prefill, strip fences, fallback)
  const rawText = "{" + data.content[0].text;
  let cleaned = rawText;
  cleaned = cleaned.replace(/^```json\s*\n?/gm, "");
  cleaned = cleaned.replace(/\n?```\s*$/gm, "");
  cleaned = cleaned.replace(/```/g, "");
  cleaned = cleaned.trim();

  let parsed: PostIncidentReview;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch (e2) {
        console.error(
          "[post-incident-analyzer] JSON extraction failed:",
          (match[0] || "").substring(0, 200)
        );
        throw e2;
      }
    } else {
      console.error(
        "[post-incident-analyzer] No JSON found in:",
        cleaned.substring(0, 300)
      );
      throw new Error("Failed to parse post-incident review JSON");
    }
  }

  // 11. Store in post_incident_reviews
  await supabaseAdmin.from("post_incident_reviews").upsert(
    {
      incident_id: incidentId,
      what_happened: parsed.what_happened,
      what_went_well: parsed.what_went_well,
      what_went_wrong: parsed.what_went_wrong,
      action_items: parsed.action_items,
      response_time_assessment: parsed.response_time_assessment,
      narrative_outcome: parsed.narrative_outcome,
      template_effectiveness: parsed.template_effectiveness,
      response_time_minutes: responseTimeMinutes,
      total_mentions: mentions.length,
      peak_engagement: peakEngagement,
      platforms: platforms,
      stakeholder_completion: `${notifiedStakeholders}/${totalStakeholders}`,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "incident_id" }
  );

  return parsed;
}
