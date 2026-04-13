"use client";

const PLATFORM_ICONS: Record<string, string> = {
  hackernews: "\u{1F536}",
  reddit: "\u{1F534}",
  twitter: "\uD835\uDD4F",
  discord: "\u{1F4AC}",
  youtube: "\u25B6\uFE0F",
  rss: "\uD83D\uDCF0",
};

interface PropagationBadgeProps {
  propagation: {
    cluster_id: string;
    cluster_title: string;
    platforms_reached: string[];
  };
  onClick?: () => void;
}

export default function PropagationBadge({ propagation, onClick }: PropagationBadgeProps) {
  const count = propagation.platforms_reached.length;
  if (count < 2) return null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium
        bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 border border-blue-200
        hover:from-blue-100 hover:to-cyan-100 transition-colors cursor-pointer"
      title={propagation.cluster_title}
    >
      <span>{"\uD83C\uDF0A"}</span>
      <span>Spreading: {count} platforms</span>
      <span className="inline-flex gap-0.5">
        {propagation.platforms_reached.slice(0, 5).map((p) => (
          <span key={p} title={p}>
            {PLATFORM_ICONS[p] || "\u2022"}
          </span>
        ))}
      </span>
    </button>
  );
}
