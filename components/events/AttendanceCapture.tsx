"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface AttendanceCaptureProps {
  eventId: string;
}

export function AttendanceCapture({ eventId }: AttendanceCaptureProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/attendees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof json.error === "string" ? json.error : "Could not add attendee"
        );
        return;
      }
      setEmail("");
      setName("");
      setDone(true);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {done && (
        <p className="text-xs text-text-secondary" role="status">
          Saved. Add another below.
        </p>
      )}
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => {
          setDone(false);
          setEmail(e.target.value);
        }}
        required
      />
      <Input
        label="Name (optional)"
        value={name}
        onChange={(e) => {
          setDone(false);
          setName(e.target.value);
        }}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button type="submit" variant="primary" disabled={loading}>
        {loading ? "Adding…" : "Add attendee"}
      </Button>
    </form>
  );
}
