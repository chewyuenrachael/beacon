import type { FC } from "react";

import { MetricCard } from "@/components/ui/MetricCard.forge";
import type { DhvcScore } from "@/lib/types";

interface DhvcScoreCardProps {
  score: DhvcScore | undefined;
}

export const DhvcScoreCard: FC<DhvcScoreCardProps> = ({ score }) => {
  if (!score) {
    return (
      <p className="text-sm text-text-secondary">No score computed yet.</p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MetricCard value={score.total} label="Total score" mono />
      <MetricCard
        value={score.technical_output}
        label="Technical output (30%)"
        mono
      />
      <MetricCard
        value={score.public_reach}
        label="Public reach (20%)"
        mono
      />
      <MetricCard value={score.school_fit} label="School fit (25%)" mono />
      <MetricCard
        value={score.cursor_signal}
        label="Cursor signal (25%)"
        mono
      />
    </div>
  );
};
