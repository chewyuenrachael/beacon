"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EVENT_TYPES, type EventType } from "@/lib/types/event";

interface InstitutionOption {
  id: string;
  name: string;
}

interface NewEventFormProps {
  institutions: InstitutionOption[];
}

export function NewEventForm({ institutions }: NewEventFormProps) {
  const router = useRouter();
  const [institutionId, setInstitutionId] = useState(institutions[0]?.id ?? "");
  const [eventType, setEventType] = useState<EventType>("cafe_cursor");
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institution_id: institutionId,
          event_type: eventType,
          title: title.trim(),
          scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          status: scheduledAt ? "scheduled" : "draft",
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Create failed");
        return;
      }
      if (json.id) {
        router.push(`/dashboard/events/${json.id}`);
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (institutions.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        Add institutions in the database before creating events.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-lg">
      <div>
        <label className="block text-xs uppercase tracking-wider text-text-secondary font-medium mb-1.5">
          Institution
        </label>
        <select
          className="w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary"
          value={institutionId}
          onChange={(e) => setInstitutionId(e.target.value)}
          required
        >
          {institutions.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-text-secondary font-medium mb-1.5">
          Event type
        </label>
        <select
          className="w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary"
          value={eventType}
          onChange={(e) => setEventType(e.target.value as EventType)}
        >
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />

      <div>
        <label className="block text-xs uppercase tracking-wider text-text-secondary font-medium mb-1.5">
          Scheduled (optional)
        </label>
        <input
          type="datetime-local"
          className="w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-text-secondary font-medium mb-1.5">
          Notes
        </label>
        <textarea
          className="w-full min-h-[100px] rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={10000}
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? "Creating…" : "Create event"}
        </Button>
        <Link href="/dashboard/events">
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
