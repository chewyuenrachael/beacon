/**
 * Event entity writes + observations.
 */

import { logObservation } from "@/lib/observations";
import { supabaseAdmin } from "@/lib/supabase";
import type { Event, EventAttendee, EventStatus, EventType } from "@/lib/types/event";

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

export interface CreateEventInput {
  institution_id: string;
  ambassador_id?: string | null;
  event_type: EventType;
  title: string;
  scheduled_at?: string | null;
  status?: EventStatus;
  notes?: string | null;
  tracking_code: string;
}

export async function createEventWithObservation(
  input: CreateEventInput
): Promise<Event> {
  const status = input.status ?? "draft";
  const { data, error } = await supabaseAdmin
    .from("events")
    .insert({
      institution_id: input.institution_id,
      ambassador_id: input.ambassador_id ?? null,
      event_type: input.event_type,
      title: input.title,
      scheduled_at: input.scheduled_at ?? null,
      status,
      tracking_code: input.tracking_code,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create event");
  }

  const event = mapEventRow(data as Record<string, unknown>);

  await logObservation({
    entity_type: "event",
    entity_id: event.id,
    observation_type: "event_created",
    payload: {
      title: event.title,
      event_type: event.event_type,
      institution_id: event.institution_id,
      tracking_code: event.tracking_code,
      status: event.status,
    },
    source: "manual",
    confidence: 1,
  });

  return event;
}

export interface PatchEventInput {
  ambassador_id?: string | null;
  event_type?: EventType;
  title?: string;
  scheduled_at?: string | null;
  status?: EventStatus;
  notes?: string | null;
}

export async function updateEventWithObservation(
  eventId: string,
  patch: PatchEventInput,
  previousRow: Record<string, unknown>
): Promise<Event> {
  const { data, error } = await supabaseAdmin
    .from("events")
    .update(patch)
    .eq("id", eventId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update event");
  }

  await logObservation({
    entity_type: "event",
    entity_id: eventId,
    observation_type: "event_updated",
    payload: { patch: patch as Record<string, unknown>, previous: previousRow },
    source: "manual",
    confidence: 1,
  });

  return mapEventRow(data as Record<string, unknown>);
}

export async function insertAttendeeAndBumpCount(params: {
  eventId: string;
  email: string;
  name?: string | null;
  source: "dashboard" | "public_rsvp";
}): Promise<{ attendee: EventAttendee; event: Event }> {
  const { data: attendeeRow, error: insErr } = await supabaseAdmin
    .from("event_attendees")
    .insert({
      event_id: params.eventId,
      email: params.email.trim(),
      name: params.name?.trim() || null,
    })
    .select()
    .single();

  if (insErr || !attendeeRow) {
    throw new Error(insErr?.message ?? "Failed to insert attendee");
  }

  const attendee = mapAttendeeRow(attendeeRow as Record<string, unknown>);

  const { data: updatedEv, error: evErr } = await supabaseAdmin
    .from("events")
    .select("*")
    .eq("id", params.eventId)
    .single();

  if (evErr || !updatedEv) {
    throw new Error(evErr?.message ?? "Event not found after attendee insert");
  }

  await logObservation({
    entity_type: "event",
    entity_id: params.eventId,
    observation_type: "event_attendee_recorded",
    payload: {
      event_id: params.eventId,
      attendee_id: attendee.id,
      email: attendee.email,
      source: params.source,
    },
    source: "manual",
    confidence: 1,
  });

  return {
    attendee,
    event: mapEventRow(updatedEv as Record<string, unknown>),
  };
}
