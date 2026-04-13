import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { insertAttendeeAndBumpCount } from "@/lib/event-mutations";
import type { EventAttendee } from "@/lib/types/event";
import { attendeesParamsSchema, createAttendeeBodySchema } from "./schemas";

function mapAttendeeRow(row: Record<string, unknown>): EventAttendee {
  return {
    id: row.id as string,
    event_id: row.event_id as string,
    email: row.email as string,
    name: (row.name as string | null) ?? undefined,
    attended_at: row.attended_at as string,
    activated_at: (row.activated_at as string | null) ?? undefined,
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const raw = await context.params;
  const parsed = attendeesParamsSchema.safeParse(raw);
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
    const { data: ev, error: evErr } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("id", parsed.data.id)
      .maybeSingle();

    if (evErr) throw evErr;
    if (!ev) {
      return NextResponse.json(
        { error: "Event not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("event_attendees")
      .select("*")
      .eq("event_id", parsed.data.id)
      .order("attended_at", { ascending: false });

    if (error) throw error;

    const attendees = (data ?? []).map((row) =>
      mapAttendeeRow(row as Record<string, unknown>)
    );
    return NextResponse.json({ data: attendees });
  } catch (e) {
    const message = e instanceof Error ? e.message : "List failed";
    console.error("[api/events/[id]/attendees GET]", e);
    return NextResponse.json(
      { error: message, code: "LIST_FAILED" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const rawParams = await context.params;
  const paramsParsed = attendeesParamsSchema.safeParse(rawParams);
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

  const bodyParsed = createAttendeeBodySchema.safeParse(body);
  if (!bodyParsed.success) {
    const msg = bodyParsed.error.issues[0]?.message ?? "Invalid body";
    return NextResponse.json({ error: msg, code: "VALIDATION" }, { status: 400 });
  }

  try {
    const { data: ev, error: evErr } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("id", paramsParsed.data.id)
      .maybeSingle();

    if (evErr) throw evErr;
    if (!ev) {
      return NextResponse.json(
        { error: "Event not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const result = await insertAttendeeAndBumpCount({
      eventId: paramsParsed.data.id,
      email: bodyParsed.data.email,
      name: bodyParsed.data.name ?? null,
      source: "dashboard",
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    console.error("[api/events/[id]/attendees POST]", e);
    return NextResponse.json(
      { error: message, code: "CREATE_FAILED" },
      { status: 500 }
    );
  }
}
