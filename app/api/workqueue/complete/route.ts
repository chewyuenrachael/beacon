import { NextResponse } from "next/server";
import { z } from "zod";
import { logObservation } from "@/lib/observations";

const bodySchema = z.object({
  item_id: z.string().min(1),
  title: z.string().min(1),
  source_feature: z.string().min(1),
  entity_type: z.enum(["professor", "ambassador", "institution"]),
  entity_id: z.string().min(1),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "VALIDATION" },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", code: "VALIDATION" },
      { status: 400 }
    );
  }

  const b = parsed.data;

  try {
    await logObservation({
      entity_type: b.entity_type,
      entity_id: b.entity_id,
      observation_type: "action_completed",
      payload: {
        workqueue_item_id: b.item_id,
        title: b.title,
        source_feature: b.source_feature,
        completed_via: "dashboard_workqueue",
      },
      source: "manual",
      confidence: 1.0,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Observation write failed";
    return NextResponse.json(
      { error: msg, code: "INTERNAL" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
