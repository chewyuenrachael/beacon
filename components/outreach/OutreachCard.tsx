import Link from "next/link";
import type { OutreachTouchpoint } from "@/lib/types/outreach";

export function OutreachCard(props: {
  touchpoint: OutreachTouchpoint;
  institutionLabel?: string;
}) {
  const { touchpoint: t, institutionLabel } = props;
  return (
    <Link
      href={`/dashboard/outreach/${t.id}`}
      className="block rounded-lg border border-cream-200 bg-white p-3 shadow-sm hover:border-cream-300 transition-colors"
    >
      <p className="text-sm font-medium text-ink-900 line-clamp-2">
        {t.target_name}
      </p>
      <p className="text-xs text-ink-500 mt-1">
        {t.target_type.replace(/_/g, " ")} · {t.channel}
        {institutionLabel ? ` · ${institutionLabel}` : ""}
      </p>
      {t.subject_line ? (
        <p className="text-xs text-ink-400 mt-2 line-clamp-2">{t.subject_line}</p>
      ) : null}
    </Link>
  );
}
