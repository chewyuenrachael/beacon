# Data Contracts

Every inter-stage interface in the pipeline has a TypeScript type. Agents must not invent new types; they must import from `lib/types.ts`.

## Core types

```typescript
// Observation — the source of truth unit
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
  | "action_completed";

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
  entity_type: "institution" | "professor" | "ambassador" | "student_org" | "outreach";
  entity_id: string;
  observation_type: ObservationType;
  payload: Record<string, unknown>;
  source: ObservationSource;
  source_url?: string;
  confidence: number; // 0.0 - 1.0
  observed_at: string;
  created_at: string;
}

// Professor current state
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

export interface PublicStatement {
  quote: string;
  source_url: string;
  date: string;
  source_type: "twitter" | "blog" | "podcast" | "other";
}

// Ambassador
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
```

## Keyword list for recent_relevant_papers_count

When matching paper abstracts, count papers whose title OR abstract contain ANY of:
- "large language model" / "LLM" / "language model"
- "code generation" / "code completion"
- "AI-assisted programming" / "AI coding"
- "developer productivity"
- "Copilot" / "Cursor"
- "software engineering" (only if combined with "AI" or "ML" in the same paper)
- "program synthesis"
- "repository-level" + "model"
- "chain of thought" + "code"

This is an exact keyword match, case-insensitive. NO semantic classification. NO inference. The count is the number of papers in the last 24 months where at least one keyword match is found in the title+abstract text.

## Confidence scoring

- `1.0` — Verified directly (e.g., user confirmed their institution)
- `0.9` — Strong automated signal (e.g., GitHub org membership in MIT-official org)
- `0.7` — Multiple corroborating signals
- `0.5` — Single moderate signal (e.g., .edu email)
- `0.3` — Weak inferential signal (e.g., one collaborator at MIT)
- `0.0` — No signal; placeholder only

## Contract: logObservation()

```typescript
export async function logObservation(params: {
  entity_type: Observation["entity_type"];
  entity_id: string;
  observation_type: ObservationType;
  payload: Record<string, unknown>;
  source: ObservationSource;
  source_url?: string;
  confidence: number;
}): Promise<Observation>;
```

All entity mutations go through this function. Never write to entity tables without a corresponding observation.