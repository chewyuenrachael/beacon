import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createEventWithObservation } from "@/lib/event-mutations";
import type { Event, EventStatus, EventType } from "@/lib/types/event";
import { createEventBodySchema, listEventsQuerySchema } from "./schemas";

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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = {
    institution_id: url.searchParams.get("institution_id") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  };
  const parsed = listEventsQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.flatten().fieldErrors.status?.[0] ?? "Invalid query",
        code: "VALIDATION",
      },
      { status: 400 }
    );
  }

  try {
    let q = supabaseAdmin.from("events").select("*").order("scheduled_at", {
      ascending: false,
      nullsFirst: false,
    });

    if (parsed.data.institution_id) {
      q = q.eq("institution_id", parsed.data.institution_id);
    }
    if (parsed.data.status) {
      q = q.eq("status", parsed.data.status);
    }

    const { data, error } = await q;
    if (error) throw error;

    const events = (data ?? []).map((row) =>
      mapEventRow(row as Record<string, unknown>)
    );
    return NextResponse.json({ data: events });
  } catch (e) {
    const message = e instanceof Error ? e.message : "List failed";
    console.error("[api/events GET]", e);
    return NextResponse.json(
      { error: message, code: "LIST_FAILED" },
      { status: 500 }
    );
  }
}

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

  const parsed = createEventBodySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid body";
    return NextResponse.json({ error: msg, code: "VALIDATION" }, { status: 400 });
  }

  const tracking_code = randomUUID();

  try {
    const event = await createEventWithObservation({
      institution_id: parsed.data.institution_id,
      ambassador_id: parsed.data.ambassador_id ?? null,
      event_type: parsed.data.event_type as EventType,
      title: parsed.data.title,
      scheduled_at: parsed.data.scheduled_at ?? null,
      status: parsed.data.status as EventStatus | undefined,
      notes: parsed.data.notes ?? null,
      tracking_code,
    });
    return NextResponse.json(event, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    console.error("[api/events POST]", e);
    return NextResponse.json(
      { error: message, code: "CREATE_FAILED" },
      { status: 500 }
    );
  }
}
