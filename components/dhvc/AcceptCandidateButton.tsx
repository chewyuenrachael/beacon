"use client";

import { useState, type FC } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";

interface AcceptCandidateButtonProps {
  candidateId: string;
  disabled?: boolean;
}

export const AcceptCandidateButton: FC<AcceptCandidateButtonProps> = ({
  candidateId,
  disabled,
}) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOutreach, setCreateOutreach] = useState(true);

  async function onAccept() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dhvc/candidates/${candidateId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          create_outreach_touchpoint: createOutreach,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? `Accept failed (${res.status})`);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Accept failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs text-text-secondary">
        <input
          type="checkbox"
          checked={createOutreach}
          onChange={(e) => setCreateOutreach(e.target.checked)}
        />
        Open outreach drafting flow after accept
      </label>
      <Button
        variant="primary"
        onClick={onAccept}
        disabled={loading || disabled}
      >
        {loading ? "Accepting…" : "Accept candidate"}
      </Button>
      {error && <p className="text-xs text-[#8A2020]">{error}</p>}
    </div>
  );
};
