"use client";

import { useRouter } from "next/navigation";
import { useState, type FC } from "react";
import { Button } from "@/components/ui/Button";

interface RescoreButtonProps {
  ambassadorId: string;
}

export const RescoreButton: FC<RescoreButtonProps> = ({ ambassadorId }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onRescore() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/ambassadors/${ambassadorId}/score`, {
        method: "POST",
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Rescore failed");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRescore}
        disabled={loading}
      >
        {loading ? "Scoring…" : "Re-score from application"}
      </Button>
      {err && <p className="text-xs text-[#8A2020] mt-1">{err}</p>}
    </div>
  );
};
