-- Resource Hub: view audit (filesystem resources; views in DB)

CREATE TABLE resource_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  resource_slug text NOT NULL,
  viewer_id text NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  time_on_page_seconds int
);

CREATE INDEX resource_views_slug_viewed_at_idx ON resource_views (
  resource_slug,
  viewed_at DESC
);

CREATE INDEX resource_views_viewed_at_idx ON resource_views (viewed_at DESC);

ALTER TABLE resource_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY resource_views_anon_select ON resource_views FOR SELECT TO anon USING (true);

CREATE POLICY resource_views_service_role_insert ON resource_views FOR INSERT TO service_role
WITH
  CHECK (true);

CREATE POLICY resource_views_service_role_update ON resource_views FOR UPDATE TO service_role USING (true)
WITH
  CHECK (true);

GRANT SELECT ON resource_views TO anon;

GRANT ALL ON resource_views TO service_role;
