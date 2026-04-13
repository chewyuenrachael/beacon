"use client";

import { useRouter } from "next/navigation";
import { useState, type FC } from "react";
import { Button } from "@/components/ui/Button";
import type { AmbassadorStage } from "@/lib/types";

interface AdvanceStageButtonProps {
  ambassadorId: string;
  options: readonly AmbassadorStage[];
}

export const AdvanceStageButton: FC<AdvanceStageButtonProps> = ({
  ambassadorId,
  options,
}) => {
  const router = useRouter();
  const [stage, setStage] = useState<AmbassadorStage | "">(
    () => options[0] ?? ""
  );
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (options.length === 0) {
    return (
      <p className="text-xs text-text-tertiary">
        No legal stage transitions from the current stage.
      </p>
    );
  }

  async function onAdvance() {
    if (!stage) return;
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/ambassadors/${ambassadorId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_stage: stage }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? `Advance failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs uppercase tracking-wider text-text-secondary font-medium">
        New stage
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value as AmbassadorStage)}
          className="h-9 min-w-[200px] rounded-md border border-[#D0CCC4] bg-white px-3 text-sm text-text-primary"
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="primary"
          onClick={onAdvance}
          disabled={loading || !stage}
        >
          {loading ? "Updating…" : "Advance stage"}
        </Button>
      </div>
      {err && <p className="text-xs text-[#8A2020]">{err}</p>}
    </div>
  );
};
