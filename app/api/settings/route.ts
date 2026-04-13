import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from("beacon_settings")
      .select("key, value")
      .in("key", ["slack_webhook_url"]);

    const settings: Record<string, string> = {};
    for (const row of data || []) {
      settings[row.key] = row.value;
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    if (body.slack_webhook_url !== undefined) {
      if (
        body.slack_webhook_url &&
        !body.slack_webhook_url.startsWith("https://hooks.slack.com/")
      ) {
        return NextResponse.json(
          { error: "Invalid Slack webhook URL" },
          { status: 400 }
        );
      }

      await supabaseAdmin.from("beacon_settings").upsert({
        key: "slack_webhook_url",
        value: body.slack_webhook_url,
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/settings error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save settings" },
      { status: 500 }
    );
  }
}
