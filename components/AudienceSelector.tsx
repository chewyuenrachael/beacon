"use client";

import type { Audience } from "@/lib/types";

const AUDIENCE_EMOJI: Record<string, string> = {
  comms: "📡",
  product: "🛠️",
  engineering: "⚙️",
  safety: "🛡️",
  policy: "🏛️",
  executive: "👔",
};

interface AudienceSelectorProps {
  audiences: Audience[];
  selectedSlug: string;
  onSelect: (slug: string) => void;
  briefCounts?: Record<string, number>;
}

export default function AudienceSelector({
  audiences,
  selectedSlug,
  onSelect,
  briefCounts,
}: AudienceSelectorProps) {
  // Sort: comms first, then alphabetical
  const sorted = [...audiences].sort((a, b) => {
    if (a.slug === "comms") return -1;
    if (b.slug === "comms") return 1;
    return a.display_name.localeCompare(b.display_name);
  });

  return (
    <div className="flex overflow-x-auto gap-2 pb-1 -mb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {sorted.map((aud) => {
        const isSelected = aud.slug === selectedSlug;
        const emoji = AUDIENCE_EMOJI[aud.slug] || "📋";
        const count = briefCounts?.[aud.slug];

        return (
          <button
            key={aud.slug}
            onClick={() => onSelect(aud.slug)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
              isSelected
                ? "bg-accent-terracotta text-white"
                : "bg-cream-100 text-ink-700 border border-cream-200 hover:bg-cream-200"
            }`}
          >
            <span>{emoji}</span>
            <span>{aud.display_name}</span>
            {count !== undefined && count > 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  isSelected
                    ? "bg-white/20 text-white"
                    : "bg-cream-200 text-ink-500"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
