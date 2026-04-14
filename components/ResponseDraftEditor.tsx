"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import type {
  ResponseDraft,
  DraftComment,
  DraftStatus,
  Incident,
  StakeholderRole,
} from "@/lib/warroom-ui";
import { CHANNEL_CONFIG, safeFetchArray } from "@/lib/warroom-ui";
import DraftCommentsComponent from "@/components/DraftComments";
import TemplateSelector from "@/components/TemplateSelector";

interface ResponseDraftEditorProps {
  incidentId: string;
  incident: Incident;
  onRefresh?: () => void;
}

export default function ResponseDraftEditor({
  incidentId,
  incident,
  onRefresh,
}: ResponseDraftEditorProps) {
  const [drafts, setDrafts] = useState<ResponseDraft[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [comments, setComments] = useState<DraftComment[]>([]);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Inline comment selection
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(null);
  const [showCommentOnSelection, setShowCommentOnSelection] = useState(false);
  const [inlineCommentBody, setInlineCommentBody] = useState("");
  const [inlineCommentAuthor, setInlineCommentAuthor] = useState("");
  const [inlineCommentRole, setInlineCommentRole] = useState<StakeholderRole>("comms");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeDraft = drafts.find((d) => d.id === activeDraftId) || null;

  // Load drafts
  const loadDrafts = useCallback(async () => {
    const data = await safeFetchArray<ResponseDraft>(`/api/incidents/${incidentId}/drafts`);
    setDrafts(data);
    setDraftsLoading(false);
    if (data.length > 0 && !activeDraftId) {
      setActiveDraftId(data[0].id);
      setBody(data[0].body);
    }
  }, [incidentId, activeDraftId]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  // Load comments when active draft changes
  useEffect(() => {
    if (!activeDraftId) {
      setComments([]);
      return;
    }
    async function loadComments() {
      const data = await safeFetchArray<DraftComment>(
        `/api/incidents/${incidentId}/drafts/${activeDraftId}/comments`
      );
      setComments(data);
    }
    loadComments();
  }, [incidentId, activeDraftId]);

  // Switch active draft
  function switchDraft(draftId: string) {
    const draft = drafts.find((d) => d.id === draftId);
    if (draft) {
      setActiveDraftId(draftId);
      setBody(draft.body);
      setPreviewMode(false);
      setSelection(null);
    }
  }

  // Save draft body
  async function saveDraft() {
    if (!activeDraftId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/incidents/${incidentId}/drafts/${activeDraftId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (res.ok) {
        setSaveStatus("Saved");
        const updated = await res.json();
        setDrafts((prev) => prev.map((d) => (d.id === activeDraftId ? { ...d, ...updated } : d)));
        onRefresh?.();
      } else {
        setSaveStatus("Failed to save");
      }
    } catch {
      setSaveStatus("Failed to save");
    }
    setSaving(false);
    setTimeout(() => setSaveStatus(null), 3000);
  }

  // Change draft status
  async function changeStatus(newStatus: DraftStatus, extra?: Record<string, string>) {
    if (!activeDraftId) return;
    setStatusUpdating(true);
    try {
      const payload: Record<string, unknown> = { status: newStatus, ...extra };
      const res = await fetch(`/api/incidents/${incidentId}/drafts/${activeDraftId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setDrafts((prev) => prev.map((d) => (d.id === activeDraftId ? { ...d, ...updated } : d)));
        onRefresh?.();
      }
    } catch {
      // silent
    }
    setStatusUpdating(false);
  }

  // Create new draft from template selection
  async function handleTemplateSelect(templateBody: string, templateId: string | null, title: string) {
    setShowTemplateSelector(false);
    try {
      const res = await fetch(`/api/incidents/${incidentId}/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body: templateBody === "__ai_draft__" ? "" : templateBody,
          template_id: templateId,
          channel: "statement",
          use_ai: templateBody === "__ai_draft__",
        }),
      });
      if (res.ok) {
        const newDraft = await res.json();
        setDrafts((prev) => [...prev, newDraft]);
        setActiveDraftId(newDraft.id);
        setBody(newDraft.body || "");
        onRefresh?.();
      }
    } catch {
      // silent
    }
  }

  // Handle text selection in textarea
  function handleTextareaMouseUp() {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start !== end) {
      setSelection({ start, end, text: body.slice(start, end) });
      setShowCommentOnSelection(true);
    } else {
      setSelection(null);
      setShowCommentOnSelection(false);
    }
  }

  // Add inline comment
  async function handleAddInlineComment() {
    if (!selection || !inlineCommentBody.trim() || !inlineCommentAuthor.trim() || !activeDraftId) return;
    try {
      const res = await fetch(`/api/incidents/${incidentId}/drafts/${activeDraftId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: inlineCommentAuthor,
          role: inlineCommentRole,
          body: inlineCommentBody,
          selection_start: selection.start,
          selection_end: selection.end,
        }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => [...prev, newComment]);
        setShowCommentOnSelection(false);
        setInlineCommentBody("");
        setSelection(null);
        onRefresh?.();
      }
    } catch {
      // silent
    }
  }

  // Add general comment
  async function handleAddComment(comment: {
    author: string;
    role: StakeholderRole;
    body: string;
    selection_start?: number;
    selection_end?: number;
  }) {
    if (!activeDraftId) return;
    try {
      const res = await fetch(`/api/incidents/${incidentId}/drafts/${activeDraftId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(comment),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => [...prev, newComment]);
        onRefresh?.();
      }
    } catch {
      // silent
    }
  }

  // Resolve comment
  async function handleResolveComment(commentId: string, resolvedBy: string) {
    if (!activeDraftId) return;
    try {
      const res = await fetch(`/api/incidents/${incidentId}/drafts/${activeDraftId}/comments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment_id: commentId, resolved_by: resolvedBy }),
      });
      if (res.ok) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, is_resolved: true, resolved_by: resolvedBy } : c))
        );
      }
    } catch {
      // silent
    }
  }

  // Render [NEEDS INPUT: ...] markers in preview
  function renderBodyWithMarkers(text: string) {
    const parts = text.split(/(\[NEEDS INPUT:[^\]]*\])/g);
    return parts
      .map((part, i) => {
        if (part.match(/^\[NEEDS INPUT:/)) {
          return `<span class="bg-red-100 text-red-700 px-1 rounded font-medium">${part}</span>`;
        }
        return part;
      })
      .join("");
  }

  const STATUS_LABELS: Record<DraftStatus, string> = {
    draft: "Draft",
    review: "In Review",
    approved: "Approved",
    sent: "Sent",
  };

  const STATUS_PILL: Record<DraftStatus, string> = {
    draft: "bg-gray-100 text-gray-600",
    review: "bg-amber-50 text-amber-700",
    approved: "bg-emerald-50 text-emerald-700",
    sent: "bg-blue-50 text-blue-700",
  };

  if (draftsLoading) {
    return (
      <div className="animate-beacon space-y-3 py-4">
        <div className="h-6 bg-cream-200 rounded w-1/3" />
        <div className="h-64 bg-cream-200 rounded" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Draft tabs */}
      <div className="flex items-center gap-1 border-b border-cream-200 pb-0 mb-0 overflow-x-auto">
        {drafts.map((d) => {
          const ch = CHANNEL_CONFIG[d.channel] || { emoji: "📄", label: d.channel };
          return (
            <button
              key={d.id}
              onClick={() => switchDraft(d.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors whitespace-nowrap ${
                d.id === activeDraftId
                  ? "border-ink-900 text-ink-900 font-medium"
                  : "border-transparent text-ink-400 hover:text-ink-600"
              }`}
            >
              {ch.emoji} {d.title} (v{d.version})
            </button>
          );
        })}
        <button
          onClick={() => setShowTemplateSelector(true)}
          className="px-3 py-2 text-sm text-accent-terracotta hover:bg-orange-50 rounded transition-colors whitespace-nowrap"
        >
          + New Draft
        </button>
      </div>

      {activeDraft ? (
        <>
          {/* Top bar */}
          <div className="flex items-center gap-2 py-2 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_PILL[activeDraft.status]}`}>
              {STATUS_LABELS[activeDraft.status]}
            </span>
            {activeDraft.channel && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cream-100 text-ink-500 border border-cream-200">
                {(CHANNEL_CONFIG[activeDraft.channel] || { emoji: "📄" }).emoji}{" "}
                {(CHANNEL_CONFIG[activeDraft.channel] || { label: activeDraft.channel }).label}
              </span>
            )}
            <span className="text-xs text-ink-300">v{activeDraft.version}</span>

            <div className="ml-auto flex items-center gap-2">
              {/* Edit/Preview toggle */}
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className="text-xs border border-gray-200 rounded px-2 py-1 hover:bg-cream-50 transition-colors"
              >
                {previewMode ? "Edit" : "Preview"}
              </button>

              {/* Save */}
              {!previewMode && (
                <button
                  onClick={saveDraft}
                  disabled={saving}
                  className="text-xs bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-800 disabled:opacity-40 transition-colors"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              )}
              {saveStatus && (
                <span className={`text-xs ${saveStatus === "Saved" ? "text-emerald-600" : "text-red-600"}`}>
                  {saveStatus}
                </span>
              )}
            </div>
          </div>

          {/* Status action buttons */}
          <div className="flex items-center gap-2 pb-2 border-b border-cream-100">
            {activeDraft.status === "draft" && (
              <button
                onClick={() => changeStatus("review")}
                disabled={statusUpdating}
                className="text-xs bg-amber-500 text-white px-3 py-1 rounded hover:bg-amber-600 disabled:opacity-40 transition-colors"
              >
                Submit for Review
              </button>
            )}
            {activeDraft.status === "review" && (
              <>
                <button
                  onClick={() => {
                    const approver = prompt("Approver name:");
                    if (approver) changeStatus("approved", { approved_by: approver });
                  }}
                  disabled={statusUpdating}
                  className="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                >
                  Approve ✓
                </button>
                <button
                  onClick={() => changeStatus("draft")}
                  disabled={statusUpdating}
                  className="text-xs border border-gray-200 px-3 py-1 rounded hover:bg-cream-50 disabled:opacity-40 transition-colors"
                >
                  Request Changes ↩
                </button>
              </>
            )}
            {activeDraft.status === "approved" && (
              <>
                <button
                  onClick={() => changeStatus("sent")}
                  disabled={statusUpdating}
                  className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  Mark as Sent
                </button>
                <button
                  onClick={() => changeStatus("review")}
                  disabled={statusUpdating}
                  className="text-xs border border-gray-200 px-3 py-1 rounded hover:bg-cream-50 disabled:opacity-40 transition-colors"
                >
                  Revoke Approval
                </button>
              </>
            )}
            {activeDraft.status === "sent" && (
              <span className="text-xs text-ink-300">✅ Sent{activeDraft.approved_by ? ` · Approved by ${activeDraft.approved_by}` : ""}</span>
            )}
          </div>

          {/* Editor / Preview */}
          <div className="flex-1 min-h-0 mt-2 relative">
            {previewMode ? (
              <div className="prose prose-sm max-w-none h-full overflow-y-auto bg-white border border-cream-200 rounded-lg p-4">
                {body.includes("[NEEDS INPUT") ? (
                  <div
                    className="text-sm text-ink-700"
                    dangerouslySetInnerHTML={{ __html: renderBodyWithMarkers(body) }}
                  />
                ) : (
                  <ReactMarkdown
                    components={{
                      code: ({ children, ...props }) => (
                        <code className="bg-cream-100 px-1 py-0.5 rounded text-sm" {...props}>
                          {children}
                        </code>
                      ),
                    }}
                  >
                    {body}
                  </ReactMarkdown>
                )}
              </div>
            ) : (
              <div className="relative h-full">
                <textarea
                  ref={textareaRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onMouseUp={handleTextareaMouseUp}
                  onBlur={saveDraft}
                  className="w-full h-full min-h-[400px] text-sm text-ink-700 font-mono bg-white border border-cream-200 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
                  placeholder="Write your response draft..."
                />

                {/* Floating comment on selection button */}
                {showCommentOnSelection && selection && (
                  <div className="absolute top-2 right-2 bg-white border border-cream-200 rounded-lg shadow-lg p-3 z-10 w-64">
                    <p className="text-xs text-ink-400 mb-2">
                      Comment on: &ldquo;{selection.text.slice(0, 40)}{selection.text.length > 40 ? "..." : ""}&rdquo;
                    </p>
                    <input
                      type="text"
                      placeholder="Your name"
                      value={inlineCommentAuthor}
                      onChange={(e) => setInlineCommentAuthor(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded px-2 py-1 mb-1.5 focus:outline-none focus:ring-1 focus:ring-gray-900"
                    />
                    <textarea
                      placeholder="Add comment..."
                      value={inlineCommentBody}
                      onChange={(e) => setInlineCommentBody(e.target.value)}
                      rows={2}
                      className="w-full text-xs border border-gray-200 rounded px-2 py-1 mb-1.5 focus:outline-none focus:ring-1 focus:ring-gray-900 resize-none"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={handleAddInlineComment}
                        disabled={!inlineCommentBody.trim() || !inlineCommentAuthor.trim()}
                        className="text-xs bg-gray-900 text-white px-2 py-1 rounded hover:bg-gray-800 disabled:opacity-40 transition-colors"
                      >
                        Comment
                      </button>
                      <button
                        onClick={() => {
                          setShowCommentOnSelection(false);
                          setSelection(null);
                        }}
                        className="text-xs text-ink-400 hover:text-ink-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Comments section */}
          <div className="mt-4 pt-3 border-t border-cream-200">
            <h4 className="text-sm font-medium text-ink-900 mb-3">Comments</h4>
            <DraftCommentsComponent
              comments={comments}
              draftId={activeDraftId || ""}
              incidentId={incidentId}
              onAddComment={handleAddComment}
              onResolveComment={handleResolveComment}
            />
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center py-16">
          <div className="text-center">
            <p className="text-sm text-ink-300 mb-3">No drafts yet.</p>
            <button
              onClick={() => setShowTemplateSelector(true)}
              className="text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-colors"
            >
              Create First Draft
            </button>
          </div>
        </div>
      )}

      {/* Template selector modal */}
      {showTemplateSelector && (
        <TemplateSelector
          incident={incident}
          onSelect={handleTemplateSelect}
          onCancel={() => setShowTemplateSelector(false)}
        />
      )}
    </div>
  );
}
