"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OutreachChannel, OutreachTargetType } from "@/lib/types/outreach";

export function NewOutreachForm(props: {
  professorOptions: { id: string; name: string; institution_id: string }[];
}) {
  const router = useRouter();
  const [targetType, setTargetType] = useState<OutreachTargetType>("professor");
  const [targetId, setTargetId] = useState("");
  const [channel, setChannel] = useState<OutreachChannel>("email");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId.trim(),
          channel,
        }),
      });
      const json = (await res.json()) as {
        data?: { id: string };
        draft_error?: string;
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Request failed");
        return;
      }
      if (json.draft_error) {
        setError(`Saved touchpoint but draft failed: ${json.draft_error}`);
      }
      if (json.data?.id) {
        router.push(`/dashboard/outreach/${json.data.id}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setPending(false);
    }
  }

  const showProfessorSelect = targetType === "professor";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-ink-500 mb-1">Target type</label>
        <select
          className="w-full text-sm border border-cream-200 rounded-md px-2 py-2 bg-white"
          value={targetType}
          onChange={(e) =>
            setTargetType(e.target.value as OutreachTargetType)
          }
        >
          <option value="professor">Professor</option>
          <option value="student_org">Student org</option>
          <option value="ta">TA</option>
          <option value="department_chair">Department chair</option>
          <option value="hackathon_organizer">Hackathon organizer</option>
        </select>
      </div>

      {showProfessorSelect ? (
        <div>
          <label className="block text-xs text-ink-500 mb-1">Professor</label>
          <select
            required
            className="w-full text-sm border border-cream-200 rounded-md px-2 py-2 bg-white"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            <option value="">Select…</option>
            {props.professorOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.institution_id})
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="block text-xs text-ink-500 mb-1">Target id</label>
          <input
            required
            className="w-full text-sm border border-cream-200 rounded-md px-2 py-2 bg-white"
            placeholder="org slug or identifier"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          />
        </div>
      )}

      <div>
        <label className="block text-xs text-ink-500 mb-1">Channel</label>
        <select
          className="w-full text-sm border border-cream-200 rounded-md px-2 py-2 bg-white"
          value={channel}
          onChange={(e) => setChannel(e.target.value as OutreachChannel)}
        >
          <option value="email">Email</option>
          <option value="meeting">Meeting</option>
          <option value="event">Event</option>
        </select>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="text-sm px-4 py-2 rounded-lg bg-ink-900 text-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create & generate draft"}
      </button>
    </form>
  );
}
