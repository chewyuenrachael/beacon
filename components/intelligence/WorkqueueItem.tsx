"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import type { WorkqueueItem as WqItem } from "@/lib/types/intelligence";

export function WorkqueueItem({
  item,
  rank,
}: {
  item: WqItem;
  rank: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function markComplete() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/workqueue/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: item.id,
          title: item.title,
          source_feature: item.source_feature,
          entity_type: item.mark_complete.entity_type,
          entity_id: item.mark_complete.entity_id,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? res.statusText);
      }
      setMsg("Logged.");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
            #{rank} · score {item.priority_score.toFixed(1)} ·{" "}
            {item.source_feature}
          </p>
          <h2 className="text-base font-semibold text-text-primary">
            {item.title}
          </h2>
          <p className="text-sm text-text-secondary">{item.description}</p>
        </div>
        <div className="flex flex-col gap-2 items-stretch sm:items-end shrink-0">
          <Link
            href={item.action_url}
            className="inline-flex justify-center rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-sm font-medium text-text-primary hover:border-border-strong"
          >
            {item.action_label}
          </Link>
          <button
            type="button"
            onClick={markComplete}
            disabled={busy}
            className="inline-flex justify-center rounded-md border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary disabled:opacity-50"
          >
            {busy ? "Saving…" : "Mark complete"}
          </button>
          {msg ? (
            <span className="text-[11px] text-text-tertiary text-right">{msg}</span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
