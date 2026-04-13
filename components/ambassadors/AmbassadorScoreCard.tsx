import type { FC } from "react";
import { MetricCard } from "@/components/ui/MetricCard.forge";
import type { AmbassadorScore } from "@/lib/types";

interface AmbassadorScoreCardProps {
  score: AmbassadorScore | undefined;
}

export const AmbassadorScoreCard: FC<AmbassadorScoreCardProps> = ({ score }) => {
  if (!score) {
    return (
      <p className="text-sm text-text-secondary">No score computed yet.</p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MetricCard value={score.total} label="Total score" mono />
      <MetricCard
        value={score.research_alignment}
        label="Research alignment (30%)"
        mono
      />
      <MetricCard
        value={score.student_reach}
        label="Student reach (25%)"
        mono
      />
      <MetricCard
        value={score.adoption_signal}
        label="Adoption signal (25%)"
        mono
      />
      <MetricCard
        value={score.network_influence}
        label="Network influence (20%)"
        mono
      />
    </div>
  );
};
