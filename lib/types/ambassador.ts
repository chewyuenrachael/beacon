/**
 * @ownership Ambassador Pipeline agent
 * @see `.cursor/rules/data-contracts.md` — Type file ownership
 */

/** Subset of Typeform-shaped application payload used for manual entry + scoring */
export interface AmbassadorApplicationData {
  why_cursor: string;
  past_community_work: string;
  proposed_events: string;
  expected_reach: string;
}

export interface AmbassadorScore {
  research_alignment: number;
  student_reach: number;
  adoption_signal: number;
  network_influence: number;
  total: number;
}

export type AmbassadorStage =
  | "applied"
  | "under_review"
  | "accepted"
  | "rejected"
  | "onboarding"
  | "active"
  | "slowing"
  | "inactive";

export interface Ambassador {
  id: string;
  institution_id: string;
  email: string;
  name: string;
  github_username?: string;
  application_data: Record<string, unknown>;
  score?: AmbassadorScore;
  stage: AmbassadorStage;
  health_score: number;
  accepted_at?: string;
  last_active_at?: string;
}

/** Row shape for `ambassador_activity` projection table */
export interface AmbassadorActivity {
  id: string;
  ambassador_id: string;
  activity_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export const AMBASSADOR_STAGES: readonly AmbassadorStage[] = [
  "applied",
  "under_review",
  "accepted",
  "rejected",
  "onboarding",
  "active",
  "slowing",
  "inactive",
] as const;
