"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type {
  PostIncidentReview as PostIncidentReviewType,
  ActionItem,
  Incident,
} from "@/app/dashboard/warroom/types";
import { safeFetch } from "@/app/dashboard/warroom/types";

interface PostIncidentReviewProps {
  incidentId: string;
  incident: Incident;
}

export default function PostIncidentReview({ incidentId, incident }: PostIncidentReviewProps) {
  const [review, setReview] = useState<PostIncidentReviewType | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [reviewedBy, setReviewedBy] = useState("");

  // Editable fields
  const [whatHappened, setWhatHappened] = useState("");
  const [whatWentWell, setWhatWentWell] = useState("");
  const [whatWentWrong, setWhatWentWrong] = useState("");
  const [narrativeOutcome, setNarrativeOutcome] = useState("");
  const [templateEffectiveness, setTemplateEffectiveness] = useState("");
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);

  useEffect(() => {
    async function load() {
      const data = await safeFetch<PostIncidentReviewType>(
        `/api/incidents/${incidentId}/review`
      );
      if (data) {
        setReview(data);
        setWhatHappened(data.what_happened);
        setWhatWentWell(data.what_went_well);
        setWhatWentWrong(data.what_went_wrong);
        setNarrativeOutcome(data.narrative_outcome || "");
        setTemplateEffectiveness(data.template_effectiveness || "");
        setActionItems(data.action_items || []);
        setReviewedBy(data.reviewed_by || "");
      }
      setLoading(false);
    }
    load();
  }, [incidentId]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/incidents/${incidentId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setReview(data);
        setWhatHappened(data.what_happened);
        setWhatWentWell(data.what_went_well);
        setWhatWentWrong(data.what_went_wrong);
        setNarrativeOutcome(data.narrative_outcome || "");
        setTemplateEffectiveness(data.template_effectiveness || "");
        setActionItems(data.action_items || []);
      }
    } catch {
      // silent
    }
    setGenerating(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/incidents/${incidentId}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          what_happened: whatHappened,
          what_went_well: whatWentWell,
          what_went_wrong: whatWentWrong,
          narrative_outcome: narrativeOutcome,
          template_effectiveness: templateEffectiveness,
          action_items: actionItems,
          reviewed_by: reviewedBy || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setReview(data);
        setDirty(false);
        setEditing(false);
        setSaveStatus("Saved");
      } else {
        setSaveStatus("Failed");
      }
    } catch {
      setSaveStatus("Failed");
    }
    setSaving(false);
    setTimeout(() => setSaveStatus(null), 3000);
  }

  function handleExport() {
    const md = `# Post-Incident Review: ${incident.title}

**Response Time:** ${review?.response_time_minutes ?? "N/A"} minutes
**Duration:** ${incident.first_detected_at || incident.created_at} → ${incident.resolved_at || "ongoing"}

## What Happened
${whatHappened}

## What Went Well
${whatWentWell}

## What Went Wrong
${whatWentWrong}

## Action Items
${actionItems.map((a) => `- [${a.status === "done" ? "x" : " "}] ${a.action} (Owner: ${a.owner}${a.deadline ? `, Due: ${a.deadline}` : ""})`).join("\n")}

## Narrative Outcome
${narrativeOutcome || "N/A"}

## Template Effectiveness
${templateEffectiveness || "N/A"}

${reviewedBy ? `**Reviewed by:** ${reviewedBy}` : ""}
`;
    navigator.clipboard.writeText(md);
    setSaveStatus("Copied to clipboard");
    setTimeout(() => setSaveStatus(null), 3000);
  }

  function updateField(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setter(e.target.value);
      setDirty(true);
    };
  }

  function addActionItem() {
    setActionItems((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, action: "", owner: "", deadline: null, status: "open" },
    ]);
    setDirty(true);
  }

  function updateActionItem(id: string, field: keyof ActionItem, value: string) {
    setActionItems((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
    setDirty(true);
  }

  if (loading) {
    return (
      <div className="animate-beacon space-y-3">
        <div className="h-4 w-48 bg-cream-200 rounded" />
        <div className="h-20 bg-cream-200 rounded" />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="border border-cream-200 rounded-lg p-6 bg-white text-center">
        <h3 className="text-sm font-medium text-ink-900 mb-2">
          Post-Incident Review
        </h3>
        <p className="text-xs text-ink-400 mb-4">
          Analyze the incident timeline, response drafts, and stakeholder notifications
          to produce a structured review.
        </p>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-40 transition-colors"
        >
          {generating ? "Generating..." : "Generate Post-Incident Review"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-ink-900">Post-Incident Review</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditing(!editing)}
            className="text-xs border border-gray-200 rounded px-2 py-1 hover:bg-cream-50 transition-colors"
          >
            {editing ? "View" : "Edit"}
          </button>
          <button
            onClick={handleExport}
            className="text-xs border border-gray-200 rounded px-2 py-1 hover:bg-cream-50 transition-colors"
          >
            Export
          </button>
          {saveStatus && (
            <span className={`text-xs ${saveStatus === "Saved" || saveStatus.includes("clipboard") ? "text-emerald-600" : "text-red-600"}`}>
              {saveStatus}
            </span>
          )}
        </div>
      </div>

      {/* Response time */}
      <div className="bg-white border border-cream-200 rounded-lg p-4">
        <p className="text-sm text-ink-700">
          <span className="font-medium">Response Time:</span>{" "}
          {review.response_time_minutes != null ? `${review.response_time_minutes} minutes` : "N/A"}
        </p>
      </div>

      {/* Sections */}
      {[
        { label: "What Happened", value: whatHappened, setter: setWhatHappened },
        { label: "What Went Well", value: whatWentWell, setter: setWhatWentWell },
        { label: "What Went Wrong", value: whatWentWrong, setter: setWhatWentWrong },
        { label: "Narrative Outcome", value: narrativeOutcome, setter: setNarrativeOutcome },
        { label: "Template Effectiveness", value: templateEffectiveness, setter: setTemplateEffectiveness },
      ].map(({ label, value, setter }) => (
        <div key={label} className="bg-white border border-cream-200 rounded-lg p-4">
          <h4 className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-2">{label}</h4>
          {editing ? (
            <textarea
              value={value}
              onChange={updateField(setter)}
              rows={4}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
            />
          ) : (
            <div className="prose prose-sm max-w-none text-sm text-ink-700">
              <ReactMarkdown>{value || "*No content yet.*"}</ReactMarkdown>
            </div>
          )}
        </div>
      ))}

      {/* Action items */}
      <div className="bg-white border border-cream-200 rounded-lg p-4">
        <h4 className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-2">
          Action Items
        </h4>
        <div className="space-y-2">
          {actionItems.length === 0 && !editing && (
            <p className="text-sm text-ink-300">No action items.</p>
          )}
          {actionItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 p-2 rounded bg-cream-50"
            >
              {editing ? (
                <>
                  <input
                    type="text"
                    value={item.action}
                    onChange={(e) => updateActionItem(item.id, "action", e.target.value)}
                    placeholder="Action"
                    className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                  <input
                    type="text"
                    value={item.owner}
                    onChange={(e) => updateActionItem(item.id, "owner", e.target.value)}
                    placeholder="Owner"
                    className="w-28 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                  <input
                    type="date"
                    value={item.deadline || ""}
                    onChange={(e) => updateActionItem(item.id, "deadline", e.target.value)}
                    className="text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                  <select
                    value={item.status}
                    onChange={(e) => updateActionItem(item.id, "status", e.target.value)}
                    className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  >
                    <option value="open">Open</option>
                    <option value="in-progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </>
              ) : (
                <>
                  <span className="text-sm">
                    {item.status === "done" ? "☑" : "☐"}
                  </span>
                  <span className={`text-sm flex-1 ${item.status === "done" ? "line-through text-ink-300" : "text-ink-700"}`}>
                    {item.action}
                  </span>
                  <span className="text-xs text-ink-400">{item.owner}</span>
                  {item.deadline && (
                    <span className="text-xs text-ink-300">{item.deadline}</span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    item.status === "done"
                      ? "bg-emerald-50 text-emerald-700"
                      : item.status === "in-progress"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-gray-50 text-gray-600"
                  }`}>
                    {item.status}
                  </span>
                </>
              )}
            </div>
          ))}
          {editing && (
            <button
              onClick={addActionItem}
              className="text-xs text-accent-terracotta hover:underline"
            >
              + Add Action Item
            </button>
          )}
        </div>
      </div>

      {/* Reviewed by */}
      <div className="bg-white border border-cream-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-700">Reviewed by:</span>
          {editing ? (
            <input
              type="text"
              value={reviewedBy}
              onChange={(e) => { setReviewedBy(e.target.value); setDirty(true); }}
              placeholder="Name"
              className="text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          ) : (
            <span className="text-sm text-ink-500">{reviewedBy || "Not yet reviewed"}</span>
          )}
        </div>
      </div>

      {/* Save button */}
      {editing && dirty && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-40 transition-colors"
        >
          {saving ? "Saving..." : "Save Edits"}
        </button>
      )}
    </div>
  );
}
