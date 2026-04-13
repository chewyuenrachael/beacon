import type { FC } from "react";
import { Badge } from "@/components/ui/Badge";
import type { AmbassadorStage } from "@/lib/types";

const STAGE_LABEL: Record<AmbassadorStage, string> = {
  applied: "Applied",
  under_review: "Under review",
  accepted: "Accepted",
  rejected: "Rejected",
  onboarding: "Onboarding",
  active: "Active",
  slowing: "Slowing",
  inactive: "Inactive",
};

const STAGE_VARIANT: Record<AmbassadorStage, "amber" | "blue" | "green" | "red" | "purple" | "gray"> = {
  applied: "gray",
  under_review: "amber",
  accepted: "green",
  rejected: "red",
  onboarding: "blue",
  active: "green",
  slowing: "amber",
  inactive: "gray",
};

interface StageBadgeProps {
  stage: AmbassadorStage;
  className?: string;
}

export const StageBadge: FC<StageBadgeProps> = ({ stage, className = "" }) => {
  return (
    <span className={className}>
      <Badge variant={STAGE_VARIANT[stage]}>{STAGE_LABEL[stage]}</Badge>
    </span>
  );
};
