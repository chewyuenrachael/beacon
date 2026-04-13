"use client";

import { useRouter } from "next/navigation";
import { useState, type FC } from "react";

export const ReenrichButton: FC<{ professorId: string }> = ({ professorId }) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/professors/${professorId}/enrich`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-cream-100 disabled:opacity-50"
      >
        {pending ? "Re-enriching…" : "Re-enrich"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};
