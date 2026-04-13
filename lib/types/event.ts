/**
 * @ownership Event Toolkit agent
 * @see `.cursor/rules/data-contracts.md` — Type file ownership
 */

export const EVENT_TYPES = [
  "cafe_cursor",
  "hackathon_sponsorship",
  "workshop",
  "lab_demo",
  "professor_talk",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_STATUSES = [
  "draft",
  "scheduled",
  "completed",
  "cancelled",
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

/** Row shape aligned with `events` table (SCHEMA.md) */
export interface Event {
  id: string;
  institution_id: string;
  ambassador_id?: string | null;
  event_type: EventType;
  title: string;
  scheduled_at?: string | null;
  status: EventStatus;
  tracking_code: string;
  attendee_count: number;
  notes?: string | null;
  created_at: string;
}

/** Row shape aligned with `event_attendees` table */
export interface EventAttendee {
  id: string;
  event_id: string;
  email: string;
  name?: string | null;
  attended_at: string;
  activated_at?: string | null;
}

/** Payloads for observations until beacon-core ObservationType includes event_* */
export interface EventObservationPayloadCreated {
  title: string;
  event_type: EventType;
  institution_id: string;
  tracking_code: string;
  status: EventStatus;
}

export interface EventObservationPayloadUpdated {
  patch: Record<string, unknown>;
  previous?: Record<string, unknown>;
}

export interface EventObservationPayloadAttendeeRecorded {
  event_id: string;
  attendee_id: string;
  email: string;
  source: "dashboard" | "public_rsvp";
}
