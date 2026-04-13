import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  updateEventWithObservation,
  type PatchEventInput,
} from "@/lib/event-mutations";
import type { Event, EventStatus, EventType } from "@/lib/types/event";
import { eventIdParamsSchema, patchEventBodySchema } from "./schemas";

function mapEventRow(row: Record<string, unknown>): Event {
  return {
    id: row.id as string,
    institution_id: row.institution_id as string,
    ambassador_id: (row.ambassador_id as string | null) ?? undefined,
    event_type: row.event_type as EventType,
    title: row.title as string,
    scheduled_at: (row.scheduled_at as string | null) ?? undefined,
    status: row.status as EventStatus,
    tracking_code: row.tracking_code as string,
    attendee_count: Number(row.attendee_count ?? 0),
    notes: (row.notes as string | null) ?? undefined,
    created_at: row.created_at as string,
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const raw = await context.params;
  const parsed = eventIdParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.flatten().fieldErrors.id?.[0] ?? "Invalid id",
        code: "VALIDATION",
      },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("events")
      .select("*")
      .eq("id", parsed.data.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: "Event not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }
    return NextResponse.json(mapEventRow(data as Record<string, unknown>));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Load failed";
    console.error("[api/events/[id] GET]", parsed.data.id, e);
    return NextResponse.json(
      { error: message, code: "LOAD_FAILED" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const rawParams = await context.params;
  const paramsParsed = eventIdParamsSchema.safeParse(rawParams);
  if (!paramsParsed.success) {
    return NextResponse.json(
      {
        error: paramsParsed.error.flatten().fieldErrors.id?.[0] ?? "Invalid id",
        code: "VALIDATION",
      },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "VALIDATION" },
      { status: 400 }
    );
  }

  const bodyParsed = patchEventBodySchema.safeParse(body);
  if (!bodyParsed.success) {
    const msg = bodyParsed.error.issues[0]?.message ?? "Invalid body";
    return NextResponse.json({ error: msg, code: "VALIDATION" }, { status: 400 });
  }

  try {
    const { data: existing, error: loadErr } = await supabaseAdmin
      .from("events")
      .select("*")
      .eq("id", paramsParsed.data.id)
      .maybeSingle();

    if (loadErr) throw loadErr;
    if (!existing) {
      return NextResponse.json(
        { error: "Event not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const previous = existing as Record<string, unknown>;
    const event = await updateEventWithObservation(
      paramsParsed.data.id,
      bodyParsed.data as PatchEventInput,
      previous
    );
    return NextResponse.json(event);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    console.error("[api/events/[id] PATCH]", paramsParsed.data.id, e);
    return NextResponse.json(
      { error: message, code: "UPDATE_FAILED" },
      { status: 500 }
    );
  }
}
