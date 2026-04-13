"use client";

import { useEffect, useState } from "react";

interface NarrativeItem {
  slug: string;
  display_name: string;
  description?: string;
  target_pull_through: number;
  is_active: boolean;
}

interface KeyMessage {
  id: string;
  shorthand: string;
  message: string;
  is_active?: boolean;
}

export default function NarrativeSettings() {
  const [narratives, setNarratives] = useState<NarrativeItem[]>([]);
  const [fallbackMessages, setFallbackMessages] = useState<KeyMessage[]>([]);
  const [useFallback, setUseFallback] = useState(false);
  const [editState, setEditState] = useState<Record<string, Partial<NarrativeItem>>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, string>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTarget, setNewTarget] = useState("50");
  const [addStatus, setAddStatus] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      // Try narratives API
      try {
        const res = await fetch("/api/narratives");
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : data.data || [];
          if (items.length > 0) {
            setNarratives(items);
            const edits: Record<string, Partial<NarrativeItem>> = {};
            for (const n of items) {
              edits[n.slug] = { display_name: n.display_name, target_pull_through: n.target_pull_through, is_active: n.is_active };
            }
            setEditState(edits);
            return;
          }
        }
      } catch { /* */ }

      // Fallback to key messages
      setUseFallback(true);
      try {
        const res = await fetch("/api/pullthrough/messages");
        if (res.ok) {
          const data = await res.json();
          setFallbackMessages(Array.isArray(data) ? data : data.data || []);
        }
      } catch { /* */ }
    }
    load();
  }, []);

  function updateEdit(slug: string, field: string, value: unknown) {
    setEditState((p) => ({
      ...p,
      [slug]: { ...p[slug], [field]: value },
    }));
  }

  async function handleSave(slug: string) {
    const edit = editState[slug];
    if (!edit) return;
    setSaveStatus((p) => ({ ...p, [slug]: "saving" }));
    try {
      const res = await fetch(`/api/narratives/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edit),
      });
      setSaveStatus((p) => ({ ...p, [slug]: res.ok ? "saved" : "error" }));
      setTimeout(() => setSaveStatus((p) => ({ ...p, [slug]: "" })), 3000);
    } catch {
      setSaveStatus((p) => ({ ...p, [slug]: "error" }));
    }
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    setAddStatus("saving");
    try {
      const res = await fetch("/api/narratives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: newName.trim(),
          description: newDesc.trim() || null,
          target_pull_through: parseInt(newTarget) / 100,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setNarratives((p) => [...p, data]);
        setEditState((p) => ({
          ...p,
          [data.slug]: {
            display_name: data.display_name,
            target_pull_through: data.target_pull_through,
            is_active: data.is_active,
          },
        }));
        setNewName("");
        setNewDesc("");
        setNewTarget("50");
        setShowAdd(false);
        setAddStatus(null);
      } else {
        setAddStatus("error");
      }
    } catch {
      setAddStatus("error");
    }
  }

  async function handleDelete(slug: string) {
    try {
      const res = await fetch(`/api/narratives/${slug}`, { method: "DELETE" });
      if (res.ok) {
        setNarratives((p) => p.filter((n) => n.slug !== slug));
        setDeleteConfirm(null);
      }
    } catch { /* */ }
  }

  async function handleScoreNow() {
    setScoring(true);
    try {
      await fetch("/api/pullthrough/score", { method: "POST" });
    } catch { /* */ }
    setScoring(false);
  }

  // Fallback: show key messages read-only
  if (useFallback) {
    return (
      <div>
        <p className="text-xs text-ink-400 mb-3">
          Showing key messages from pull-through scoring. Narrative priority management requires the narratives API.
        </p>
        {fallbackMessages.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {fallbackMessages.map((m) => (
              <div key={m.id} className="px-4 py-3">
                <p className="text-sm font-medium text-gray-900">{m.shorthand}</p>
                <p className="text-xs text-gray-400 italic mt-0.5">&ldquo;{m.message}&rdquo;</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-300">No key messages configured.</p>
        )}
        <button
          onClick={handleScoreNow}
          disabled={scoring}
          className="mt-3 text-sm border border-gray-200 rounded-md px-4 py-2 hover:border-gray-300 disabled:opacity-50 transition-colors"
        >
          {scoring ? "Scoring..." : "Score mentions now"}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Narrative list */}
      {narratives.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 mb-3">
          {narratives.map((n) => {
            const edit = editState[n.slug] || {};
            const status = saveStatus[n.slug] || "";

            return (
              <div key={n.slug} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={edit.display_name ?? n.display_name}
                    onChange={(e) => updateEdit(n.slug, "display_name", e.target.value)}
                    className="flex-1 text-sm border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round((edit.target_pull_through ?? n.target_pull_through) * 100)}
                      onChange={(e) => updateEdit(n.slug, "target_pull_through", parseInt(e.target.value) / 100)}
                      className="w-16 text-sm text-center border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                    <span className="text-xs text-gray-400">%</span>
                  </div>
                  <button
                    onClick={() =>
                      updateEdit(n.slug, "is_active", !(edit.is_active ?? n.is_active))
                    }
                    className={`w-8 h-4 rounded-full transition-colors relative ${
                      (edit.is_active ?? n.is_active) ? "bg-emerald-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                        (edit.is_active ?? n.is_active) ? "left-4" : "left-0.5"
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => handleSave(n.slug)}
                    className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
                  >
                    Save
                  </button>
                  {deleteConfirm === n.slug ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(n.slug)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(n.slug)}
                      className="text-xs text-gray-300 hover:text-red-500 transition-colors"
                    >
                      &times;
                    </button>
                  )}
                </div>
                {status && (
                  <p className={`text-xs mt-1 ${status === "saved" ? "text-emerald-600" : status === "saving" ? "text-gray-400" : "text-red-600"}`}>
                    {status === "saved" ? "Saved" : status === "saving" ? "Saving..." : "Failed to save"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add new */}
      {showAdd ? (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
          <p className="text-xs text-gray-500 mb-2">Add new narrative priority</p>
          <div className="space-y-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Display name"
              className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Target:</label>
              <input
                type="number"
                min={0}
                max={100}
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                className="w-16 text-sm text-center border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
              <span className="text-xs text-gray-400">%</span>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={addStatus === "saving"}
                  className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {addStatus === "saving" ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => { setShowAdd(false); setAddStatus(null); }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
            {addStatus === "error" && <p className="text-xs text-red-600">Failed to create</p>}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="text-xs text-accent-terracotta hover:underline mb-3"
        >
          + Add narrative priority
        </button>
      )}

      {/* Score trigger */}
      <div className="mt-3">
        <button
          onClick={handleScoreNow}
          disabled={scoring}
          className="text-sm border border-gray-200 rounded-md px-4 py-2 hover:border-gray-300 disabled:opacity-50 transition-colors"
        >
          {scoring ? "Scoring..." : "Score mentions now"}
        </button>
      </div>
    </div>
  );
}
