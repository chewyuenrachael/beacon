-- Discount provisioning: SheerID verification attempts (demo uses mock; production swaps to real SheerID API).

CREATE TABLE verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  email text NOT NULL,
  country text,
  claimed_institution text,
  sheerid_response_code text NOT NULL,
  status text NOT NULL,
  reviewed_by text,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT verification_attempts_status_check CHECK (
    status IN (
      'pending',
      'approved',
      'rejected',
      'manual_review'
    )
  )
);

CREATE INDEX verification_attempts_status_created_at_idx ON verification_attempts (status, created_at DESC);

CREATE INDEX verification_attempts_country_idx ON verification_attempts (country);

ALTER TABLE verification_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY verification_attempts_anon_select ON verification_attempts FOR SELECT TO anon USING (true);

CREATE POLICY verification_attempts_service_role_insert ON verification_attempts FOR INSERT TO service_role
WITH
  CHECK (true);

CREATE POLICY verification_attempts_service_role_update ON verification_attempts FOR UPDATE TO service_role USING (true)
WITH
  CHECK (true);

GRANT SELECT ON verification_attempts TO anon;

GRANT ALL ON verification_attempts TO service_role;
