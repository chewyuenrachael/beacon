// @ownership dhvc-module

export const DHVC_SOURCES = ["devpost", "github", "arxiv", "manual"] as const;
export type DhvcSource = (typeof DHVC_SOURCES)[number];

export const DHVC_REVIEW_STAGES = [
  "pending_review",
  "accepted",
  "rejected",
  "archived",
] as const;
export type DhvcReviewStage = (typeof DHVC_REVIEW_STAGES)[number];

export interface DhvcSourceUrl {
  url: string;
  source: DhvcSource;
  observed_at: string;
  description: string; // "HackMIT 2025 finalist", "Top contributor to repo X", "First author on Paper Y"
}

export interface DhvcScore {
  technical_output: number; // 0-100, weighted 30%
  public_reach: number; // 0-100, weighted 20%
  school_fit: number; // 0-100, weighted 25%
  cursor_signal: number; // 0-100, weighted 25%
  total: number; // 0-100, weighted sum
}

export interface DhvcCandidate {
  id: string;
  institution_id: string;
  name: string;
  email?: string;
  github_username?: string;
  twitter_handle?: string;
  primary_source: DhvcSource;
  source_urls: DhvcSourceUrl[];
  graduation_year?: number;
  major?: string;
  score?: DhvcScore;
  review_stage: DhvcReviewStage;
  reviewed_by?: string;
  reviewed_at?: string;
  notes?: string;
  discovered_at: string;
  last_enriched_at?: string;
}

export interface DhvcCandidateDraft {
  institution_id: string;
  name: string;
  email?: string;
  github_username?: string;
  twitter_handle?: string;
  primary_source: DhvcSource;
  source_urls: DhvcSourceUrl[];
  graduation_year?: number;
  major?: string;
}
