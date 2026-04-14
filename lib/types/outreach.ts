/** Feature 5 — outreach CRM and draft generation */

export type OutreachTargetType =
  | "professor"
  | "student_org"
  | "ta"
  | "department_chair"
  | "hackathon_organizer";

/** Targets whose `target_id` refers to a `professors.id` row. */
export const PROFESSOR_LINKED_TARGET_TYPES = [
  "professor",
  "ta",
  "department_chair",
] as const;

export type ProfessorLinkedTargetType =
  (typeof PROFESSOR_LINKED_TARGET_TYPES)[number];

export function isProfessorLinkedTargetType(
  t: OutreachTargetType
): t is ProfessorLinkedTargetType {
  return (PROFESSOR_LINKED_TARGET_TYPES as readonly string[]).includes(t);
}

export type OutreachStage =
  | "cold"
  | "contacted"
  | "meeting_booked"
  | "demo_held"
  | "partnership_active"
  | "dead";

export type OutreachChannel = "email" | "meeting" | "event";

/** Row shape for `outreach_touchpoints` (Postgres enum columns map to string at rest). */
export interface OutreachTouchpoint {
  id: string;
  target_type: OutreachTargetType;
  target_id: string;
  target_name: string;
  stage: OutreachStage;
  channel: OutreachChannel;
  subject_line: string;
  draft_content: string;
  sent_at?: string | null;
  reply_detected_at?: string | null;
  notes?: string | null;
  created_at: string;
}

export type ReferencedFactKind =
  | "paper_match"
  | "ai_stance"
  | "public_statement"
  | "syllabus";

export interface ReferencedFact {
  kind: ReferencedFactKind;
  /** Verbatim excerpt from observation payload or professor row */
  text: string;
  source_url?: string;
}

export interface OutreachDraftResult {
  subject_line: string;
  body: string;
  tone: string;
  referenced_facts: ReferencedFact[];
}

/** Top paper lines from `paper_matches_keywords` observations (verbatim titles). */
export interface PaperMatchFactLine {
  title: string;
  abstract_snippet: string;
  observed_at: string;
  source_url?: string;
}
