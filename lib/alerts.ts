import { supabaseAdmin } from "./supabase";
import type { MentionRow, ClassificationOutput } from "./types";

async function getWebhookUrl(): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from("beacon_settings")
      .select("value")
      .eq("key", "slack_webhook_url")
      .single();
    return data?.value || process.env.SLACK_WEBHOOK_URL || null;
  } catch {
    return process.env.SLACK_WEBHOOK_URL || null;
  }
}

async function sendSlackMessage(
  webhookUrl: string,
  payload: object
): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error(
      `Slack webhook failed: ${response.status} ${response.statusText}`
    );
  }
}

export async function sendFireAlert(fires: MentionRow[]): Promise<void> {
  const webhookUrl = await getWebhookUrl();

  if (!webhookUrl) {
    console.log(`[alerts] No webhook URL configured. ${fires.length} fire(s):`);
    for (const fire of fires) {
      console.log(
        `  - [${fire.source}] ${fire.summary ?? fire.title} (${fire.source_url})`
      );
    }
    return;
  }

  const displayed = fires.slice(0, 5);

  const blocks: object[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🔥 ${fires.length} Fire${fires.length === 1 ? "" : "s"} Detected`,
        emoji: true,
      },
    },
  ];

  for (const fire of displayed) {
    const velocityInfo =
      fire.velocity_status === "accelerating"
        ? ` | ⚡ Accelerating (${fire.velocity_score?.toFixed(1)} pts/hr)`
        : "";

    const lines = [
      `*[${fire.source}]* ${fire.summary ?? fire.title}`,
      `Engagement: ${fire.engagement_score ?? 0}${velocityInfo}`,
      fire.recommended_action
        ? `Action: ${fire.recommended_action}`
        : undefined,
      `<${fire.source_url}|View →>`,
    ]
      .filter(Boolean)
      .join("\n");

    blocks.push(
      { type: "divider" },
      { type: "section", text: { type: "mrkdwn", text: lines } }
    );
  }

  if (fires.length > 5) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `+ ${fires.length - 5} more fire${fires.length - 5 === 1 ? "" : "s"} — check the dashboard.`,
        },
      ],
    });
  }

  await sendSlackMessage(webhookUrl, { blocks });
}

export async function sendSingleFireAlert(
  mention: { id: string; source: string; title: string | null; engagement_score: number; source_url?: string; author?: string | null },
  classification: ClassificationOutput
): Promise<void> {
  const webhookUrl = await getWebhookUrl();
  if (!webhookUrl) return;

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://dailybeacon-one.vercel.app";

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🔥 Fire detected",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${classification.summary || mention.title || "Unknown mention"}*`,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Source:* ${mention.author || mention.source}`,
        },
        {
          type: "mrkdwn",
          text: `*Engagement:* ${mention.engagement_score || 0} pts`,
        },
        {
          type: "mrkdwn",
          text: `*Topic:* ${classification.topic || "unclassified"}`,
        },
        {
          type: "mrkdwn",
          text: `*Emotion:* ${classification.primary_emotion || "unknown"}`,
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `📋 *Recommended action:* ${classification.recommended_action || "Review and assess"}`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View source" },
          url: mention.source_url || "#",
          action_id: "view_source",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Open in Beacon" },
          url: `${baseUrl}/dashboard?mention=${mention.id}`,
          action_id: "open_beacon",
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Beacon · ${new Date().toLocaleString("en-US", {
            timeZone: "America/Los_Angeles",
            hour: "numeric",
            minute: "2-digit",
            month: "short",
            day: "numeric",
          })} PT`,
        },
      ],
    },
  ];

  await sendSlackMessage(webhookUrl, { blocks });
}
