"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import type { VerificationAttempt } from "@/lib/types/discount";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";

type InstitutionOption = { id: string; name: string };

interface VerificationQueueProps {
  attempts: VerificationAttempt[];
  institutions: InstitutionOption[];
}

function isTerminalStatus(status: string): boolean {
  return status === "approved" || status === "rejected";
}

function timePendingLabel(attempt: VerificationAttempt): string {
  if (isTerminalStatus(attempt.status)) return "—";
  try {
    return formatDistanceToNowStrict(new Date(attempt.created_at), {
      addSuffix: false,
    });
  } catch {
    return "—";
  }
}

export function VerificationQueue({
  attempts,
  institutions,
}: VerificationQueueProps) {
  const [showAll, setShowAll] = useState(false);
  const [instByRow, setInstByRow] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<VerificationAttempt | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const selectOptions = useMemo(
    () =>
      institutions.map((i) => ({
        value: i.id,
        label: `${i.name} (${i.id})`,
      })),
    [institutions]
  );

  const defaultInst = institutions[0]?.id ?? "";

  const filtered = useMemo(() => {
    if (showAll) return attempts;
    return attempts.filter(
      (a) => a.status === "pending" || a.status === "manual_review"
    );
  }, [attempts, showAll]);

  async function approve(attempt: VerificationAttempt) {
    const institution_id =
      instByRow[attempt.id] ?? defaultInst;
    if (!institution_id) {
      alert("Add at least one institution to the database to approve.");
      return;
    }
    setBusyId(attempt.id);
    try {
      const res = await fetch(`/api/verification/${attempt.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institution_id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "Approve failed");
        return;
      }
      window.location.reload();
    } finally {
      setBusyId(null);
    }
  }

  async function submitReject() {
    if (!rejectFor || !rejectReason.trim()) return;
    setBusyId(rejectFor.id);
    try {
      const res = await fetch(`/api/verification/${rejectFor.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "Reject failed");
        return;
      }
      setRejectFor(null);
      setRejectReason("");
      window.location.reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-text-secondary">
          Showing{" "}
          {showAll ? "all statuses" : "pending and manual review"} (
          {filtered.length} rows)
        </p>
        <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="rounded border-[#D0CCC4]"
          />
          Show all statuses
        </label>
      </div>

      <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface">
        <table className="w-full min-w-[960px]">
          <thead>
            <tr className="border-b border-border-default">
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-text-tertiary font-medium">
                Email
              </th>
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-text-tertiary font-medium">
                Country
              </th>
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-text-tertiary font-medium">
                Claimed institution
              </th>
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-text-tertiary font-medium">
                Status
              </th>
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-text-tertiary font-medium">
                Response
              </th>
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-text-tertiary font-medium">
                Time pending
              </th>
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-text-tertiary font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr
                key={a.id}
                className="border-b border-border-subtle align-top"
              >
                <td className="px-3 py-2 text-sm text-text-primary font-mono">
                  {a.email}
                </td>
                <td className="px-3 py-2 text-sm text-text-primary">
                  {a.country ?? "—"}
                </td>
                <td className="px-3 py-2 text-sm text-text-primary">
                  {a.claimed_institution ?? "—"}
                </td>
                <td className="px-3 py-2 text-sm text-text-primary">
                  {a.status}
                </td>
                <td className="px-3 py-2 text-sm font-mono text-text-secondary">
                  {a.sheerid_response_code}
                </td>
                <td className="px-3 py-2 text-sm text-text-secondary">
                  {timePendingLabel(a)}
                </td>
                <td className="px-3 py-2">
                  {!isTerminalStatus(a.status) ? (
                    <div className="flex flex-col gap-2 min-w-[200px]">
                      <Select
                        value={instByRow[a.id] ?? defaultInst}
                        onChange={(e) =>
                          setInstByRow((prev) => ({
                            ...prev,
                            [a.id]: e.target.value,
                          }))
                        }
                        options={selectOptions}
                        placeholder="Institution"
                        className="w-full"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={busyId === a.id || !defaultInst}
                          onClick={() => approve(a)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busyId === a.id}
                          onClick={() => {
                            setRejectFor(a);
                            setRejectReason("");
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-text-tertiary">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-text-tertiary text-center py-8">
          No rows match this filter.
        </p>
      )}

      <Modal
        isOpen={!!rejectFor}
        onClose={() => {
          setRejectFor(null);
          setRejectReason("");
        }}
        title="Reject verification"
        size="sm"
      >
        <div className="p-4 space-y-3">
          <p className="text-sm text-text-secondary">
            Reason is required and is stored on the attempt.
          </p>
          <textarea
            className="w-full min-h-[100px] rounded-md border border-[#D0CCC4] bg-white px-3 py-2 text-sm text-text-primary"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setRejectFor(null);
                setRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!rejectReason.trim() || busyId === rejectFor?.id}
              onClick={submitReject}
            >
              Submit reject
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
