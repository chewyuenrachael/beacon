"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import type { StakeholderChecklistItem, StakeholderRole } from "@/app/dashboard/warroom/types";
import { ROLE_CONFIG } from "@/app/dashboard/warroom/types";

interface StakeholderChecklistProps {
  stakeholders: StakeholderChecklistItem[];
  incidentId: string;
  onNotify: (stakeholderId: string, notifiedBy: string) => void;
  onAddStakeholder: (stakeholder: { stakeholder_name: string; stakeholder_role: StakeholderRole; notification_channel: string; priority_order: number }) => void;
}

const ALL_ROLES: StakeholderRole[] = ["comms", "legal", "executive", "engineering", "policy"];

export default function StakeholderChecklist({
  stakeholders,
  incidentId,
  onNotify,
  onAddStakeholder,
}: StakeholderChecklistProps) {
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [notifyName, setNotifyName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<StakeholderRole>("comms");
  const [newChannel, setNewChannel] = useState("slack");
  const [newPriority, setNewPriority] = useState(stakeholders.length + 1);

  const sorted = [...stakeholders].sort((a, b) => a.priority_order - b.priority_order);
  const notifiedCount = sorted.filter((s) => s.is_notified).length;
  const total = sorted.length;
  const progress = total > 0 ? (notifiedCount / total) * 100 : 0;

  function handleNotify(id: string) {
    if (notifyingId === id && notifyName.trim()) {
      onNotify(id, notifyName.trim());
      setNotifyingId(null);
      setNotifyName("");
    } else {
      setNotifyingId(id);
      setNotifyName("");
    }
  }

  function handleAdd() {
    if (!newName.trim()) return;
    onAddStakeholder({
      stakeholder_name: newName.trim(),
      stakeholder_role: newRole,
      notification_channel: newChannel,
      priority_order: newPriority,
    });
    setNewName("");
    setNewRole("comms");
    setNewChannel("slack");
    setNewPriority(total + 2);
    setShowAdd(false);
  }

  return (
    <div>
      {/* Header + progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-ink-900">
            📋 Stakeholder Notifications
          </h3>
          <span className="text-xs text-ink-500">
            {notifiedCount}/{total} complete
          </span>
        </div>
        <div className="w-full bg-cream-200 rounded-full h-3">
          <div
            className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stakeholder list */}
      <div className="space-y-2">
        {sorted.map((s) => {
          const role = ROLE_CONFIG[s.stakeholder_role] || ROLE_CONFIG.comms;
          return (
            <div
              key={s.id}
              className={`border rounded-lg p-3 transition-colors ${
                s.is_notified
                  ? "bg-white border-cream-200 opacity-70"
                  : "bg-amber-50/50 border-amber-200"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-sm mt-0.5">
                  {s.is_notified ? "☑" : "☐"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-ink-300 font-mono">#{s.priority_order}</span>
                    <span className="text-sm font-medium text-ink-900">{s.stakeholder_name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${role.color}`}>
                      {role.emoji} {role.label}
                    </span>
                    {s.notification_channel && (
                      <span className="text-[10px] text-ink-300">via {s.notification_channel}</span>
                    )}
                  </div>

                  {s.is_notified && s.notified_at ? (
                    <p className="text-xs text-emerald-600 mt-1">
                      ✅ Notified {formatDistanceToNow(new Date(s.notified_at), { addSuffix: true })}
                      {s.notified_by && ` by ${s.notified_by}`}
                    </p>
                  ) : (
                    <div className="mt-1.5">
                      {notifyingId === s.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Your name"
                            value={notifyName}
                            onChange={(e) => setNotifyName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleNotify(s.id)}
                            className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-900"
                            autoFocus
                          />
                          <button
                            onClick={() => handleNotify(s.id)}
                            disabled={!notifyName.trim()}
                            className="text-xs bg-gray-900 text-white px-2 py-1 rounded hover:bg-gray-800 disabled:opacity-40 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setNotifyingId(null)}
                            className="text-xs text-ink-400 hover:text-ink-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleNotify(s.id)}
                          className="text-xs text-accent-terracotta hover:underline"
                        >
                          Mark Notified
                        </button>
                      )}
                    </div>
                  )}

                  {s.notes && (
                    <p className="text-xs text-ink-400 mt-1 italic">{s.notes}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add stakeholder */}
      {showAdd ? (
        <div className="mt-3 border border-cream-200 rounded-lg p-3 bg-white space-y-2">
          <input
            type="text"
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
          <div className="flex gap-2">
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as StakeholderRole)}
              className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_CONFIG[r].emoji} {ROLE_CONFIG[r].label}</option>
              ))}
            </select>
            <select
              value={newChannel}
              onChange={(e) => setNewChannel(e.target.value)}
              className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="slack">Slack</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="in-person">In-person</option>
            </select>
            <input
              type="number"
              min={1}
              placeholder="#"
              value={newPriority}
              onChange={(e) => setNewPriority(Number(e.target.value))}
              className="w-16 text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="text-sm text-ink-500 hover:text-ink-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="mt-3 text-sm text-accent-terracotta hover:underline"
        >
          + Add Stakeholder
        </button>
      )}
    </div>
  );
}
