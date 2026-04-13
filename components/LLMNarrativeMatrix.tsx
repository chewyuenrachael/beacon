"use client";

import { useMemo } from "react";
import { PLATFORM_COLORS, PLATFORM_LABELS } from "@/app/dashboard/llm-monitor/types";

interface CellData {
  present: boolean;
  framing: string; // "gain" | "loss" | "neutral" | ""
}

interface Props {
  data: Record<string, Record<string, CellData>>;
  onCellClick?: (platform: string, narrative: string) => void;
}

const NARRATIVE_DISPLAY: Record<string, string> = {
  "safety-leadership": "Safety Leadership",
  "developer-productivity": "Developer Productivity",
  "responsible-scaling": "Responsible Scaling",
  "model-capability": "Model Capability",
  "enterprise-readiness": "Enterprise Readiness",
  "research-frontier": "Research Frontier",
  "developer-empowerment": "Developer Empowerment",
};

function cellColor(cell: CellData | undefined): { bg: string; label: string } {
  if (!cell || !cell.present) return { bg: "bg-cream-100", label: "Absent" };
  if (cell.framing === "gain") return { bg: "bg-emerald-200", label: "Positive" };
  if (cell.framing === "loss") return { bg: "bg-red-200", label: "Negative" };
  return { bg: "bg-amber-200", label: "Partial" };
}

function cellEmoji(cell: CellData | undefined): string {
  if (!cell || !cell.present) return "";
  if (cell.framing === "gain") return "\u{1F7E2}";
  if (cell.framing === "loss") return "\u{1F534}";
  return "\u{1F7E1}";
}

export default function LLMNarrativeMatrix({ data, onCellClick }: Props) {
  const narratives = useMemo(() => Object.keys(data), [data]);
  const platforms = useMemo(() => {
    const set = new Set<string>();
    for (const narr of Object.values(data)) {
      for (const p of Object.keys(narr)) set.add(p);
    }
    return Array.from(set);
  }, [data]);

  const insights = useMemo(() => {
    if (narratives.length === 0 || platforms.length === 0) return [];
    const lines: string[] = [];

    for (const narr of narratives) {
      const cells = data[narr] || {};
      const present = platforms.filter(
        (p) => cells[p]?.present && cells[p]?.framing === "gain"
      );
      const absent = platforms.filter((p) => !cells[p]?.present);
      const displayName = NARRATIVE_DISPLAY[narr] || narr;

      if (present.length >= platforms.length - 1 && platforms.length > 1) {
        lines.push(
          `${displayName} is strong across platforms (${present.length}/${platforms.length} positive).`
        );
      } else if (absent.length >= platforms.length - 1 && platforms.length > 1) {
        const onlyIn = platforms.find((p) => cells[p]?.present);
        lines.push(
          `${displayName} is a blind spot \u2014 ${
            onlyIn
              ? `only reflected in ${PLATFORM_LABELS[onlyIn] || onlyIn}'s responses`
              : "absent across all platforms"
          }.`
        );
      }
    }

    return lines;
  }, [data, narratives, platforms]);

  if (narratives.length === 0) {
    return (
      <div className="bg-white border border-cream-200 rounded-xl p-6 text-center">
        <h3 className="font-display text-sm font-semibold text-ink-900 mb-2">
          Narrative Matrix
        </h3>
        <p className="text-xs text-ink-300">
          No narrative analysis data available yet. Responses will be classified
          as they are collected.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-cream-200 rounded-xl p-5">
      <h3 className="font-display text-sm font-semibold text-ink-900 mb-4">
        Narrative Matrix
      </h3>

      {/* Matrix grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left text-ink-500 font-medium pb-2 pr-3 min-w-[140px]">
                Narrative
              </th>
              {platforms.map((p) => (
                <th key={p} className="text-center pb-2 px-2 min-w-[80px]">
                  <div className="flex items-center justify-center gap-1">
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ backgroundColor: PLATFORM_COLORS[p] || "#6B6B65" }}
                    />
                    <span className="text-ink-700 font-medium">
                      {PLATFORM_LABELS[p] || p}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {narratives.map((narr) => (
              <tr key={narr} className="border-t border-cream-100">
                <td className="py-2 pr-3 text-ink-700 font-medium">
                  {NARRATIVE_DISPLAY[narr] || narr}
                </td>
                {platforms.map((p) => {
                  const cell = data[narr]?.[p];
                  const { bg, label } = cellColor(cell);
                  return (
                    <td key={p} className="py-2 px-2 text-center">
                      <button
                        onClick={() => onCellClick?.(p, narr)}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${bg} hover:ring-2 hover:ring-cream-300 transition-all`}
                        title={`${NARRATIVE_DISPLAY[narr] || narr} \u00d7 ${PLATFORM_LABELS[p] || p}: ${label}`}
                      >
                        <span className="text-sm">{cellEmoji(cell)}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-[10px] text-ink-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-emerald-200" /> Reflected (gain)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-amber-200" /> Partial (neutral)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-red-200" /> Negative (loss)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-cream-100" /> Absent
        </span>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="mt-4 pt-3 border-t border-cream-100">
          <p className="text-xs text-ink-500 leading-relaxed">
            {insights.join(" ")}
          </p>
        </div>
      )}
    </div>
  );
}
