import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { Audience } from "@/lib/types";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://dailybeacon-one.vercel.app";

async function sendSlackMessage(webhookUrl: string, payload: object): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.error(`Slack webhook failed: ${response.status} ${response.statusText}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Slack webhook error:", err);
    return false;
  }
}

function buildSlackBlocks(
  audience: Audience,
  briefText: string,
  date: string
): object {
  const truncated = briefText.length > 3000;
  const displayText = truncated
    ? briefText.substring(0, 2950) + "\n\n_Brief truncated — view full version in Beacon._"
    : briefText;

  const blocks: object[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `📋 ${audience.display_name} Daily Brief — ${date}`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: displayText,
      },
    },
  ];

  if (truncated) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `<${BASE_URL}/dashboard/brief?audience=${audience.slug}|View full brief in Beacon>`,
        },
      ],
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "View in Beacon" },
        url: `${BASE_URL}/dashboard/brief?audience=${audience.slug}`,
        action_id: "view_audience_brief",
      },
    ],
  });

  return { blocks };
}

export async function POST(request: Request) {
  try {
    let targetSlugs: string[] | null = null;
    try {
      const body = await request.json();
      if (body.audiences && Array.isArray(body.audiences)) {
        targetSlugs = body.audiences;
      }
    } catch {
      // No body or invalid JSON — deliver to all
    }

    let query = supabaseAdmin
      .from("audiences")
      .select("*")
      .eq("is_active", true)
      .not("slack_webhook_url", "is", null);

    if (targetSlugs) {
      query = query.in("slug", targetSlugs);
    }

    const { data: audiences, error: audError } = await query;
    if (audError) throw audError;
    if (!audiences || audiences.length === 0) {
      return NextResponse.json({ delivered: 0, failed: 0, results: [] });
    }

    const today = new Date().toISOString().split("T")[0];
    let delivered = 0;
    let failed = 0;
    const results: { slug: string; success: boolean }[] = [];

    for (const audience of audiences as Audience[]) {
      if (!audience.slack_webhook_url) continue;

      const { data: brief } = await supabaseAdmin
        .from("audience_briefs")
        .select("full_brief")
        .eq("audience_slug", audience.slug)
        .eq("brief_date", today)
        .single();

      if (!brief) {
        results.push({ slug: audience.slug, success: false });
        failed++;
        continue;
      }

      const payload = buildSlackBlocks(audience, brief.full_brief, today);
      const success = await sendSlackMessage(audience.slack_webhook_url, payload);

      results.push({ slug: audience.slug, success });
      if (success) delivered++;
      else failed++;
    }

    return NextResponse.json({ delivered, failed, results });
  } catch (error) {
    console.error("POST /api/briefs/audience/deliver error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delivery failed" },
      { status: 500 }
    );
  }
}
