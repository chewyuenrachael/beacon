"use client";

import { useState, type FC } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";

interface RejectCandidateButtonProps {
  candidateId: string;
  disabled?: boolean;
}

export const RejectCandidateButton: FC<RejectCandidateButtonProps> = ({
  candidateId,
  disabled,
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dhvc/candidates/${candidateId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim() || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? `Reject failed (${res.status})`);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button
        variant="secondary"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        Reject candidate
      </Button>
    );
  }

  return (
    <div className="space-y-2 max-w-md">
      <label className="block text-xs uppercase tracking-wider text-text-secondary font-medium">
        Reason (optional)
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="e.g. Not actually an undergrad / wrong school / duplicate"
        className="w-full rounded-md border border-[#D0CCC4] bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-[#C45A3C] focus:ring-1 focus:ring-[#C45A3C]/20"
      />
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          onClick={onConfirm}
          disabled={loading || disabled}
        >
          {loading ? "Rejecting…" : "Confirm reject"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setReason("");
            setError(null);
          }}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
      {error && <p className="text-xs text-[#8A2020]">{error}</p>}
    </div>
  );
};
