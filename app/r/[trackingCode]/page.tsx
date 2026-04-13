import { supabaseAdmin } from "@/lib/supabase";
import { RsvpForm } from "./RsvpForm";
import type { EventStatus, EventType } from "@/lib/types/event";

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "Date TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "full",
    timeStyle: "short",
  });
}

export default async function PublicRsvpPage({
  params,
}: {
  params: Promise<{ trackingCode: string }>;
}) {
  const { trackingCode } = await params;

  const { data: row, error } = await supabaseAdmin
    .from("events")
    .select("*")
    .eq("tracking_code", trackingCode)
    .maybeSingle();

  if (error || !row) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-cream-50">
        <div className="text-center max-w-md">
          <h1 className="text-lg font-semibold text-ink-900 font-display">
            Event not found
          </h1>
          <p className="text-sm text-ink-500 mt-2">
            Check your link or ask the host for an updated RSVP URL.
          </p>
        </div>
      </div>
    );
  }

  const status = row.status as EventStatus;
  if (status === "cancelled") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-cream-50">
        <div className="text-center max-w-md">
          <h1 className="text-lg font-semibold text-ink-900 font-display">
            This event was cancelled
          </h1>
        </div>
      </div>
    );
  }

  const institutionId = row.institution_id as string;
  const { data: inst } = await supabaseAdmin
    .from("institutions")
    .select("name")
    .eq("id", institutionId)
    .maybeSingle();

  const title = row.title as string;
  const scheduledAt = row.scheduled_at as string | null;
  const eventType = row.event_type as EventType;

  return (
    <div className="min-h-screen bg-cream-50 px-4 py-12">
      <div className="max-w-lg mx-auto rounded-md border border-[#D0CCC4] bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-wider text-ink-500 font-medium">
          RSVP
        </p>
        <h1 className="text-xl font-semibold text-ink-900 font-display mt-1">
          {title}
        </h1>
        <p className="text-sm text-ink-600 mt-2">
          {(inst?.name as string) ?? institutionId}
        </p>
        <p className="text-sm text-ink-500 mt-1">
          {eventType.replace(/_/g, " ")} · {formatWhen(scheduledAt)}
        </p>

        <div className="mt-8 border-t border-[#E8E4DC] pt-6">
          <h2 className="text-sm font-medium text-ink-900 mb-3">Register</h2>
          <RsvpForm eventId={row.id as string} />
        </div>
      </div>
    </div>
  );
}
