import Link from "next/link";
import type { Event } from "@/lib/types/event";

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

interface EventCardProps {
  event: Event;
  institutionName?: string;
}

export function EventCard({ event, institutionName }: EventCardProps) {
  return (
    <Link
      href={`/dashboard/events/${event.id}`}
      className="block rounded-md border border-border-subtle bg-surface p-4 transition-colors hover:border-[#D0CCC4]"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-primary">{event.title}</h2>
        <span className="text-xs uppercase tracking-wide text-text-secondary">
          {event.status}
        </span>
      </div>
      <p className="mt-1 text-xs text-text-secondary">
        {institutionName ?? event.institution_id} · {event.event_type.replace(/_/g, " ")}
      </p>
      <p className="mt-2 text-xs text-text-secondary">
        {formatWhen(event.scheduled_at ?? undefined)}
        {event.attendee_count > 0 && (
          <span className="ml-2 text-text-primary">
            · {event.attendee_count} attendee{event.attendee_count === 1 ? "" : "s"}
          </span>
        )}
      </p>
    </Link>
  );
}
