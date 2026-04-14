-- Feature 5: outreach CRM touchpoints

CREATE TYPE outreach_target_type AS ENUM (
  'professor',
  'student_org',
  'ta',
  'department_chair',
  'hackathon_organizer'
);

CREATE TYPE outreach_stage AS ENUM (
  'cold',
  'contacted',
  'meeting_booked',
  'demo_held',
  'partnership_active',
  'dead'
);

CREATE TABLE outreach_touchpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  target_type outreach_target_type NOT NULL,
  target_id text NOT NULL,
  target_name text NOT NULL,
  stage outreach_stage NOT NULL DEFAULT 'cold',
  channel text NOT NULL,
  subject_line text NOT NULL DEFAULT '',
  draft_content text NOT NULL DEFAULT '',
  sent_at timestamptz,
  reply_detected_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_touchpoints_channel_chk CHECK (
    channel IN ('email', 'meeting', 'event')
  )
);

CREATE INDEX outreach_touchpoints_stage_idx ON outreach_touchpoints (stage);

CREATE INDEX outreach_touchpoints_target_idx ON outreach_touchpoints (target_type, target_id);

ALTER TABLE outreach_touchpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY outreach_touchpoints_anon_select ON outreach_touchpoints FOR SELECT TO anon USING (true);

CREATE POLICY outreach_touchpoints_service_role_insert ON outreach_touchpoints FOR INSERT TO service_role
WITH
  CHECK (true);

CREATE POLICY outreach_touchpoints_service_role_update ON outreach_touchpoints FOR UPDATE TO service_role USING (true)
WITH
  CHECK (true);

CREATE POLICY outreach_touchpoints_service_role_delete ON outreach_touchpoints FOR DELETE TO service_role USING (true);

GRANT SELECT ON outreach_touchpoints TO anon;

GRANT ALL ON outreach_touchpoints TO service_role;
