-- DHVC source enum: where the candidate was discovered
CREATE TYPE dhvc_source AS ENUM (
  'devpost',
  'github',
  'arxiv',
  'manual'
);

-- DHVC review stage: lifecycle of a candidate from discovery to action
CREATE TYPE dhvc_review_stage AS ENUM (
  'pending_review',
  'accepted',
  'rejected',
  'archived'
);

CREATE TABLE dhvc_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  name text NOT NULL,
  email text,
  github_username text,
  twitter_handle text,
  primary_source dhvc_source NOT NULL,
  source_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  graduation_year int,
  major text,
  score jsonb,
  review_stage dhvc_review_stage NOT NULL DEFAULT 'pending_review',
  reviewed_by text,
  reviewed_at timestamptz,
  notes text,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  last_enriched_at timestamptz,
  CONSTRAINT dhvc_candidates_email_or_handle_chk
    CHECK (email IS NOT NULL OR github_username IS NOT NULL OR twitter_handle IS NOT NULL)
);

CREATE INDEX dhvc_candidates_institution_idx ON dhvc_candidates(institution_id);
CREATE INDEX dhvc_candidates_review_stage_idx ON dhvc_candidates(review_stage);
CREATE INDEX dhvc_candidates_score_idx ON dhvc_candidates((score->>'total'));
CREATE INDEX dhvc_candidates_discovered_at_idx ON dhvc_candidates(discovered_at DESC);

-- RLS following Beacon convention
ALTER TABLE dhvc_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY dhvc_candidates_anon_select ON dhvc_candidates
  FOR SELECT TO anon USING (true);

CREATE POLICY dhvc_candidates_service_role_insert ON dhvc_candidates
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY dhvc_candidates_service_role_update ON dhvc_candidates
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON dhvc_candidates TO anon;
GRANT ALL ON dhvc_candidates TO service_role;
