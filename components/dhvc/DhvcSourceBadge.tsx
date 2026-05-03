import type { FC } from "react";
import type { DhvcSource } from "@/lib/types";

interface DhvcSourceBadgeProps {
  source: DhvcSource;
}

const SOURCE_LABELS: Record<DhvcSource, string> = {
  devpost: "Devpost",
  github: "GitHub",
  arxiv: "arXiv",
  manual: "Manual",
};

const SOURCE_CLASSES: Record<DhvcSource, string> = {
  devpost: "bg-[#EDCFCF]/40 text-[#8A2020]",
  github: "bg-[#E8E4D9] text-text-primary",
  arxiv: "bg-[#D4E7D0] text-[#3D6B35]",
  manual: "bg-[#F0EDE6] text-text-secondary",
};

export const DhvcSourceBadge: FC<DhvcSourceBadgeProps> = ({ source }) => {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium font-mono ${SOURCE_CLASSES[source]}`}
    >
      {SOURCE_LABELS[source]}
    </span>
  );
};
