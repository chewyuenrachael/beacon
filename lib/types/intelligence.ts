/**
 * @ownership Strategic Intelligence agents
 * @see `.cursor/rules/data-contracts.md` — Type file ownership
 */

/** Which Beacon surface suggested this workqueue row */
export type WorkqueueSourceFeature =
  | "intelligence"
  | "ambassador"
  | "discount"
  | "events"
  | "outreach"
  | "coverage";

export interface WorkqueueItem {
  /** Stable id for UI keys and mark-complete payload */
  id: string;
  priority_score: number;
  title: string;
  description: string;
  action_url: string;
  action_label: string;
  source_feature: WorkqueueSourceFeature;
  /** Target entity for action_completed observation */
  mark_complete: {
    entity_type: "professor" | "ambassador" | "institution";
    entity_id: string;
  };
}

/** Synthetic row fed into pure ranking (tests + generateWorkqueue) */
export interface WorkqueueCandidate {
  id: string;
  priority_score: number;
  title: string;
  description: string;
  action_url: string;
  action_label: string;
  source_feature: WorkqueueSourceFeature;
  mark_complete: WorkqueueItem["mark_complete"];
}

export interface InstitutionProfessorSummary {
  id: string;
  name: string;
  recent_relevant_papers_count: number;
}

export interface InstitutionMetrics {
  institution_id: string;
  professor_count: number;
  avg_recent_relevant_papers: number;
  top_3_professors_by_count: InstitutionProfessorSummary[];
  ambassador_count: number;
  ambassador_active_count: number;
  upcoming_events_count: number;
  total_observations_last_30d: number;
}
