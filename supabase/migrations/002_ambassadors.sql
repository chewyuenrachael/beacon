-- Beacon: ambassadors CRM + activity log

CREATE TABLE ambassadors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  institution_id text NOT NULL REFERENCES institutions (id) ON DELETE RESTRICT,
  email text NOT NULL,
  name text NOT NULL,
  github_username text,
  application_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  score jsonb,
  stage text NOT NULL,
  health_score int NOT NULL DEFAULT 0,
  accepted_at timestamptz,
  last_active_at timestamptz
);

CREATE INDEX ambassadors_institution_id_idx ON ambassadors (institution_id);

CREATE INDEX ambassadors_stage_idx ON ambassadors (stage);

CREATE INDEX ambassadors_last_active_at_idx ON ambassadors (last_active_at DESC NULLS LAST);

CREATE TABLE ambassador_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  ambassador_id uuid NOT NULL REFERENCES ambassadors (id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ambassador_activity_ambassador_created_idx ON ambassador_activity (ambassador_id, created_at DESC);

ALTER TABLE ambassadors ENABLE ROW LEVEL SECURITY;

ALTER TABLE ambassador_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY ambassadors_anon_select ON ambassadors FOR SELECT TO anon USING (true);

CREATE POLICY ambassadors_service_role_insert ON ambassadors FOR INSERT TO service_role
WITH
  CHECK (true);

CREATE POLICY ambassadors_service_role_update ON ambassadors FOR UPDATE TO service_role USING (true)
WITH
  CHECK (true);

CREATE POLICY ambassador_activity_anon_select ON ambassador_activity FOR SELECT TO anon USING (true);

CREATE POLICY ambassador_activity_service_role_insert ON ambassador_activity FOR INSERT TO service_role
WITH
  CHECK (true);

GRANT SELECT ON ambassadors TO anon;

GRANT SELECT ON ambassador_activity TO anon;

GRANT ALL ON ambassadors TO service_role;

GRANT ALL ON ambassador_activity TO service_role;
