"use client";

import { useState, type FC } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";

interface IngestionResultLine {
  source: "devpost" | "github" | "arxiv";
  drafts_found: number;
  candidates_inserted: number;
  candidates_updated: number;
  errors: string[];
}

export const RefreshSourcesButton: FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onRefresh() {
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const res = await fetch("/api/dhvc/ingest", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        results?: IngestionResultLine[];
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? `Ingest failed (${res.status})`);
        return;
      }
      const lines = (json.results ?? []).map(
        (r) =>
          `${r.source}: ${r.candidates_inserted} new · ${r.candidates_updated} updated · ${r.drafts_found} drafts`
      );
      setSummary(lines.join(" | "));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ingest failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="primary" onClick={onRefresh} disabled={loading}>
        {loading ? "Refreshing…" : "Refresh sources"}
      </Button>
      {summary && (
        <p className="text-xs text-text-secondary font-mono">{summary}</p>
      )}
      {error && <p className="text-xs text-[#8A2020]">{error}</p>}
    </div>
  );
};
