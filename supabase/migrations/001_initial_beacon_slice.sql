-- Beacon vertical slice: institutions, professors, observations

CREATE TABLE institutions (
  id text PRIMARY KEY,
  name text NOT NULL,
  country text NOT NULL,
  cs_program_tier int,
  sheerid_supported boolean,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE professors (
  id text PRIMARY KEY,
  institution_id text NOT NULL REFERENCES institutions (id) ON DELETE RESTRICT,
  name text NOT NULL,
  title text,
  lab_name text,
  arxiv_author_id text,
  homepage_url text,
  recent_relevant_papers_count int NOT NULL DEFAULT 0,
  ai_stance_quote text,
  ai_stance_source_url text,
  public_statements jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_enriched_at timestamptz
);

CREATE TABLE observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  observation_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL,
  source_url text,
  confidence real NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX observations_entity_observed_at_idx ON observations (
  entity_type,
  entity_id,
  observed_at DESC
);

CREATE INDEX observations_type_observed_at_idx ON observations (observation_type, observed_at DESC);

ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;

ALTER TABLE professors ENABLE ROW LEVEL SECURITY;

ALTER TABLE observations ENABLE ROW LEVEL SECURITY;

-- Internal Day-1 tool: anon may read; writes only via service_role (bypasses RLS in Supabase; policies document intent).

CREATE POLICY institutions_anon_select ON institutions FOR SELECT TO anon USING (true);

CREATE POLICY institutions_service_role_insert ON institutions FOR INSERT TO service_role
WITH
  CHECK (true);

CREATE POLICY institutions_service_role_update ON institutions FOR UPDATE TO service_role USING (true)
WITH
  CHECK (true);

CREATE POLICY professors_anon_select ON professors FOR SELECT TO anon USING (true);

CREATE POLICY professors_service_role_insert ON professors FOR INSERT TO service_role
WITH
  CHECK (true);

CREATE POLICY professors_service_role_update ON professors FOR UPDATE TO service_role USING (true)
WITH
  CHECK (true);

CREATE POLICY observations_anon_select ON observations FOR SELECT TO anon USING (true);

CREATE POLICY observations_service_role_insert ON observations FOR INSERT TO service_role
WITH
  CHECK (true);

GRANT SELECT ON institutions TO anon;

GRANT SELECT ON professors TO anon;

GRANT SELECT ON observations TO anon;

GRANT ALL ON institutions TO service_role;

GRANT ALL ON professors TO service_role;

GRANT ALL ON observations TO service_role;
