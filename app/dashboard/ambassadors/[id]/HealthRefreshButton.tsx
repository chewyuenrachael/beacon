"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, type FC } from "react";
import { Button } from "@/components/ui/Button";

interface HealthRefreshButtonProps {
  ambassadorId: string;
  initialHealth: number;
}

export const HealthRefreshButton: FC<HealthRefreshButtonProps> = ({
  ambassadorId,
  initialHealth,
}) => {
  const router = useRouter();
  const [health, setHealth] = useState(initialHealth);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setHealth(initialHealth);
  }, [initialHealth]);

  async function onRecompute() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/ambassadors/${ambassadorId}/health`, {
        method: "POST",
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        health_score?: number;
      };
      if (!res.ok) {
        setErr(j.error ?? "Health compute failed");
        return;
      }
      if (typeof j.health_score === "number") {
        setHealth(j.health_score);
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-2xl font-semibold font-mono text-text-primary">
        {health}
      </p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onRecompute}
        disabled={loading}
      >
        {loading ? "Computing…" : "Recompute health"}
      </Button>
      {err && <p className="text-xs text-[#8A2020]">{err}</p>}
    </div>
  );
};
