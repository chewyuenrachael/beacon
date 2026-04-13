"use client";

import { useState } from "react";
import { z } from "zod";
import { createBrowserComponentClient } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const rsvpSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().max(200).optional(),
});

interface RsvpFormProps {
  eventId: string;
}

export function RsvpForm({ eventId }: RsvpFormProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = rsvpSchema.safeParse({
      email: email.trim(),
      name: name.trim() || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setLoading(true);
    try {
      const supabase = createBrowserComponentClient();
      const { error: insErr } = await supabase.from("event_attendees").insert({
        event_id: eventId,
        email: parsed.data.email,
        name: parsed.data.name ?? null,
      });
      if (insErr) {
        setError(insErr.message);
        return;
      }
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <p className="text-sm text-text-primary" role="status">
        You&apos;re on the list. See you there.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-md">
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        label="Name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button type="submit" variant="primary" disabled={loading}>
        {loading ? "Sending…" : "RSVP"}
      </Button>
    </form>
  );
}
