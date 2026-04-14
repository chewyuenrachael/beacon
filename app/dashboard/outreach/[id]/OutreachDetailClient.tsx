"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  allowedNextOutreachStages,
  isLegalOutreachTransition,
} from "@/lib/outreach-generator";
import type { Observation } from "@/lib/types";
import type { OutreachStage, OutreachTouchpoint } from "@/lib/types/outreach";

export function OutreachDetailClient(props: {
  touchpoint: OutreachTouchpoint;
  professor: Record<string, unknown> | null;
  observations: Observation[];
}) {
  const router = useRouter();
  const { touchpoint: initial, professor, observations } = props;
  const [touchpoint, setTouchpoint] = useState(initial);
  const [subjectLine, setSubjectLine] = useState(initial.subject_line);
  const [draftContent, setDraftContent] = useState(initial.draft_content);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nextStages = allowedNextOutreachStages(touchpoint.stage);

  async function saveDraft() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/outreach/${touchpoint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_line: subjectLine,
          draft_content: draftContent,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setTouchpoint(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/outreach/${touchpoint.id}/draft`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Regenerate failed");
      setSubjectLine(json.data.subject_line);
      setDraftContent(json.data.draft_content);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regenerate failed");
    } finally {
      setBusy(false);
    }
  }

  async function advanceStage(to: OutreachStage) {
    if (!isLegalOutreachTransition(touchpoint.stage, to)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/outreach/${touchpoint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: to }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Stage update failed");
      setTouchpoint(json.data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stage update failed");
    } finally {
      setBusy(false);
    }
  }

  async function patchSentReply(body: {
    sent_at?: string | null;
    reply_detected_at?: string | null;
  }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/outreach/${touchpoint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      setTouchpoint(json.data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900">Factual basis</h2>
        {professor ? (
          <ul className="text-sm text-ink-600 list-disc pl-5 space-y-1">
            <li>
              <span className="font-medium text-ink-800">Name:</span>{" "}
              {String(professor.name)}
            </li>
            <li>
              <span className="font-medium text-ink-800">Institution:</span>{" "}
              {String(professor.institution_id)}
            </li>
            {professor.recent_relevant_papers_count != null ? (
              <li>
                <span className="font-medium text-ink-800">
                  Recent relevant papers (count):
                </span>{" "}
                {String(professor.recent_relevant_papers_count)}
              </li>
            ) : null}
            {professor.ai_stance_quote ? (
              <li>
                <span className="font-medium text-ink-800">AI stance (verbatim):</span>{" "}
                <span className="whitespace-pre-wrap">{String(professor.ai_stance_quote)}</span>
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="text-sm text-ink-500">
            No professor row linked for this target type.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-900">Draft</h2>
        <label className="block text-xs text-ink-500">Subject</label>
        <input
          className="w-full text-sm border border-cream-200 rounded-md px-2 py-2 bg-white"
          value={subjectLine}
          onChange={(e) => setSubjectLine(e.target.value)}
        />
        <label className="block text-xs text-ink-500">Body</label>
        <textarea
          className="w-full min-h-[200px] text-sm border border-cream-200 rounded-md px-2 py-2 bg-white font-mono"
          value={draftContent}
          onChange={(e) => setDraftContent(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => regenerate()}
            className="text-sm px-3 py-1.5 rounded-lg border border-cream-300 hover:bg-cream-50"
          >
            Regenerate
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => saveDraft()}
            className="text-sm px-3 py-1.5 rounded-lg bg-ink-900 text-white"
          >
            Save draft
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900">Stage</h2>
        <p className="text-xs text-ink-500">Current: {touchpoint.stage}</p>
        <div className="flex flex-wrap gap-2">
          {nextStages.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy || s === touchpoint.stage}
              onClick={() => advanceStage(s)}
              className="text-xs px-2 py-1 rounded border border-cream-300 hover:bg-cream-50 disabled:opacity-40"
            >
              → {s}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900">Send & reply</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              patchSentReply({ sent_at: new Date().toISOString() })
            }
            className="text-xs px-2 py-1 rounded border border-cream-300"
          >
            Log sent now
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              patchSentReply({ reply_detected_at: new Date().toISOString() })
            }
            className="text-xs px-2 py-1 rounded border border-cream-300"
          >
            Log reply detected now
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900">Observation log</h2>
        <ul className="text-xs text-ink-600 space-y-2 border border-cream-200 rounded-md p-3 bg-white max-h-64 overflow-y-auto">
          {observations.length === 0 ? (
            <li>No observations yet.</li>
          ) : (
            observations.map((o) => (
              <li key={o.id} className="border-b border-cream-100 pb-2">
                <span className="font-medium">{o.observation_type}</span> ·{" "}
                {o.observed_at}
                <pre className="mt-1 text-[11px] text-ink-500 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(o.payload, null, 2)}
                </pre>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
