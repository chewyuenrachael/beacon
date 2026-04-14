/**
 * Shared Beacon core types (SCHEMA / data-contracts).
 * @see .cursor/rules/data-contracts.md
 */

/** Reference entity — aligns with `institutions` table in SCHEMA.md */
export interface Institution {
  id: string;
  name: string;
  country: string;
  cs_program_tier?: number | null;
  sheerid_supported?: boolean | null;
  created_at?: string;
}

export type ObservationType =
  | "institution_added"
  | "professor_added"
  | "professor_enriched"
  | "paper_detected"
  | "paper_matches_keywords"
  | "syllabus_found"
  | "ai_stance_extracted"
  | "public_statement_found"
  | "github_org_membership_detected"
  | "course_repo_contribution_detected"
  | "collaborator_graph_inferred"
  | "cursor_user_institution_mapped"
  | "ambassador_applied"
  | "ambassador_enriched"
  | "ambassador_scored"
  | "ambassador_accepted"
  | "ambassador_rejected"
  | "ambassador_activity_logged"
  | "ambassador_health_computed"
  | "outreach_drafted"
  | "outreach_sent"
  | "outreach_reply_detected"
  | "hackathon_detected"
  | "student_org_detected"
  | "verification_attempted"
  | "action_completed"
  | "event_created"
  | "event_updated"
  | "event_attendee_recorded";

export type ObservationSource =
  | "arxiv"
  | "github"
  | "sheerid"
  | "manual"
  | "typeform"
  | "syllabus_scrape"
  | "serpapi"
  | "classification"
  | "keyword_match"
  | "telemetry_mock"
  | "mlh";

export interface Observation {
  id: string;
  entity_type:
    | "institution"
    | "professor"
    | "ambassador"
    | "student_org"
    | "outreach"
    | "event"
    | "resource"
    | "verification";
  entity_id: string;
  observation_type: ObservationType;
  payload: Record<string, unknown>;
  source: ObservationSource;
  source_url?: string;
  confidence: number;
  observed_at: string;
  created_at: string;
}

export interface PublicStatement {
  quote: string;
  source_url: string;
  date: string;
  source_type: "twitter" | "blog" | "podcast" | "other";
}

export interface Professor {
  id: string;
  institution_id: string;
  name: string;
  title?: string;
  lab_name?: string;
  arxiv_author_id?: string;
  homepage_url?: string;
  recent_relevant_papers_count: number;
  ai_stance_quote?: string;
  ai_stance_source_url?: string;
  public_statements: PublicStatement[];
  last_enriched_at?: string;
}
