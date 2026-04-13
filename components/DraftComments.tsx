"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import type { DraftComment, StakeholderRole } from "@/app/dashboard/warroom/types";
import { ROLE_CONFIG } from "@/app/dashboard/warroom/types";

interface DraftCommentsProps {
  comments: DraftComment[];
  draftId: string;
  incidentId: string;
  onAddComment: (comment: {
    author: string;
    role: StakeholderRole;
    body: string;
    selection_start?: number;
    selection_end?: number;
  }) => void;
  onResolveComment: (commentId: string, resolvedBy: string) => void;
}

const ALL_ROLES: StakeholderRole[] = ["comms", "legal", "executive", "engineering", "policy"];

export default function DraftComments({
  comments,
  draftId,
  incidentId,
  onAddComment,
  onResolveComment,
}: DraftCommentsProps) {
  const [author, setAuthor] = useState("");
  const [role, setRole] = useState<StakeholderRole>("comms");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveName, setResolveName] = useState("");

  const inlineComments = comments.filter((c) => c.selection_start !== null && !c.is_resolved);
  const generalComments = comments.filter((c) => c.selection_start === null && !c.is_resolved);
  const resolvedComments = comments.filter((c) => c.is_resolved);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!author.trim() || !body.trim()) return;
    setSubmitting(true);
    onAddComment({ author: author.trim(), role, body: body.trim() });
    setBody("");
    setSubmitting(false);
  }

  function handleResolve(commentId: string) {
    if (resolvingId === commentId && resolveName.trim()) {
      onResolveComment(commentId, resolveName.trim());
      setResolvingId(null);
      setResolveName("");
    } else {
      setResolvingId(commentId);
      setResolveName("");
    }
  }

  function renderComment(comment: DraftComment) {
    const roleConfig = comment.role ? ROLE_CONFIG[comment.role] : null;
    return (
      <div
        key={comment.id}
        className={`border rounded-lg p-3 ${
          comment.is_resolved ? "opacity-50 bg-cream-50 border-cream-200" : "bg-white border-cream-200"
        }`}
      >
        <div className="flex items-center gap-2 mb-1.5">
          {roleConfig && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${roleConfig.color}`}>
              {roleConfig.emoji} {roleConfig.label}
            </span>
          )}
          <span className="text-sm font-medium text-ink-900">{comment.author}</span>
          <span className="text-xs text-ink-300">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
        </div>

        {comment.selection_start !== null && (
          <div className="bg-amber-50 border-l-2 border-amber-300 px-2 py-1 mb-2 text-xs text-ink-500 italic">
            Selected text (chars {comment.selection_start}–{comment.selection_end})
          </div>
        )}

        <p className="text-sm text-ink-700 whitespace-pre-wrap">{comment.body}</p>

        {comment.is_resolved ? (
          <p className="text-xs text-ink-300 mt-2">
            ✅ Resolved{comment.resolved_by ? ` by ${comment.resolved_by}` : ""}
          </p>
        ) : (
          <div className="mt-2">
            {resolvingId === comment.id ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Your name"
                  value={resolveName}
                  onChange={(e) => setResolveName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleResolve(comment.id)}
                  className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  autoFocus
                />
                <button
                  onClick={() => handleResolve(comment.id)}
                  disabled={!resolveName.trim()}
                  className="text-xs text-emerald-600 hover:underline disabled:opacity-40"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setResolvingId(null)}
                  className="text-xs text-ink-400"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleResolve(comment.id)}
                className="text-xs text-emerald-600 hover:underline"
              >
                Resolve ✓
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Inline comments */}
      {inlineComments.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-2">
            Inline Comments ({inlineComments.length})
          </h4>
          <div className="space-y-2">
            {inlineComments.map(renderComment)}
          </div>
        </div>
      )}

      {/* General comments */}
      {generalComments.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-2">
            Comments ({generalComments.length})
          </h4>
          <div className="space-y-2">
            {generalComments.map(renderComment)}
          </div>
        </div>
      )}

      {/* Resolved */}
      {resolvedComments.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-ink-300 uppercase tracking-wide mb-2">
            Resolved ({resolvedComments.length})
          </h4>
          <div className="space-y-2">
            {resolvedComments.map(renderComment)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {comments.length === 0 && (
        <p className="text-sm text-ink-300 text-center py-4">No comments yet.</p>
      )}

      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="border-t border-cream-200 pt-3 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Your name"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as StakeholderRole)}
            className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_CONFIG[r].emoji} {ROLE_CONFIG[r].label}</option>
            ))}
          </select>
        </div>
        <textarea
          placeholder="Add a comment..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
        />
        <button
          type="submit"
          disabled={!author.trim() || !body.trim() || submitting}
          className="text-sm bg-gray-900 text-white px-4 py-1.5 rounded-md hover:bg-gray-800 disabled:opacity-40 transition-colors"
        >
          Post Comment
        </button>
      </form>
    </div>
  );
}
