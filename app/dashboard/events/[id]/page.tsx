import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { EventChecklist } from "@/components/events/EventChecklist";
import { AttendanceCapture } from "@/components/events/AttendanceCapture";
import { Card } from "@/components/ui/Card";
import { CopyRsvpLink } from "./CopyRsvpLink";
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

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: row, error } = await supabaseAdmin
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    return (
      <div className="text-sm text-text-secondary">
        Event not found{error?.message ? `: ${error.message}` : ""}.
      </div>
    );
  }

  const event = mapEventRow(row as Record<string, unknown>);

  const { data: inst } = await supabaseAdmin
    .from("institutions")
    .select("name")
    .eq("id", event.institution_id)
    .maybeSingle();

  const { data: attendeeRows } = await supabaseAdmin
    .from("event_attendees")
    .select("*")
    .eq("event_id", id)
    .order("attended_at", { ascending: false });

  const attendees = (attendeeRows ?? []).map((r) =>
    mapAttendeeRow(r as Record<string, unknown>)
  );

  const publicRsvpPath = `/r/${event.tracking_code}`;

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <Link
          href="/dashboard/events"
          className="text-xs text-text-secondary hover:text-text-primary"
        >
          ← Events
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary font-display">
              {event.title}
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              {(inst?.name as string) ?? event.institution_id} ·{" "}
              {event.event_type.replace(/_/g, " ")} · {event.status}
            </p>
            <p className="text-sm text-text-secondary mt-1">
              {formatWhen(event.scheduled_at ?? undefined)}
              {" · "}
              {event.attendee_count} RSVP
              {event.attendee_count === 1 ? "" : "s"}
            </p>
          </div>
          <CopyRsvpLink path={publicRsvpPath} />
        </div>
      </header>

      {event.notes && (
        <Card header="Notes">
          <p className="text-sm text-text-primary whitespace-pre-wrap">{event.notes}</p>
        </Card>
      )}

      <Card header="Playbook">
        <EventChecklist eventType={event.event_type} />
      </Card>

      <Card header="RSVP link (public)">
        <p className="text-xs text-text-secondary mb-2">
          Share this link for attendees to register. Count updates automatically.
        </p>
        <code className="text-sm text-text-primary break-all">{publicRsvpPath}</code>
      </Card>

      <Card header="Add attendee (dashboard)">
        <AttendanceCapture eventId={event.id} />
      </Card>

      <Card header="Attendees">
        {attendees.length === 0 ? (
          <p className="text-sm text-text-secondary">No attendees yet.</p>
        ) : (
          <ul className="divide-y divide-border-subtle text-sm">
            {attendees.map((a) => (
              <li key={a.id} className="py-2 first:pt-0">
                <span className="font-medium text-text-primary">{a.email}</span>
                {a.name && (
                  <span className="text-text-secondary"> — {a.name}</span>
                )}
                <span className="block text-xs text-text-secondary mt-0.5">
                  {formatWhen(a.attended_at)}
                  {a.activated_at && (
                    <span className="ml-2">· Activated {formatWhen(a.activated_at)}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
