import Link from "next/link";
import { createServerComponentClient } from "@/lib/supabase-server";
import { EventCard } from "@/components/events/EventCard";
import { Button } from "@/components/ui/Button";
import type { Event, EventStatus, EventType } from "@/lib/types/event";

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

export default async function EventsListPage() {
  const supabase = await createServerComponentClient();

  const { data: events, error: evErr } = await supabase
    .from("events")
    .select("*")
    .order("scheduled_at", { ascending: false, nullsFirst: false });

  const { data: institutions } = await supabase
    .from("institutions")
    .select("id,name");

  const instMap = new Map(
    (institutions ?? []).map((i) => [i.id as string, i.name as string])
  );

  if (evErr) {
    return (
      <div className="text-sm text-text-secondary">
        Could not load events{evErr.message ? `: ${evErr.message}` : ""}.
      </div>
    );
  }

  const list = (events ?? []).map((r) => mapEventRow(r as Record<string, unknown>));

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary font-display">
            Events
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Lifecycle, checklists, and RSVP links for campus programming.
          </p>
        </div>
        <Link href="/dashboard/events/new">
          <Button variant="primary">New event</Button>
        </Link>
      </header>

      {list.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No events yet.{" "}
          <Link href="/dashboard/events/new" className="text-text-primary underline">
            Create one
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((event) => (
            <li key={event.id}>
              <EventCard
                event={event}
                institutionName={instMap.get(event.institution_id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
