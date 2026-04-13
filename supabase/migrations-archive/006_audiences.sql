-- Audience-specific intelligence briefs

CREATE TABLE audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  slack_webhook_url TEXT,
  slack_channel_name TEXT,
  is_active BOOLEAN DEFAULT true,
  brief_schedule TEXT NOT NULL DEFAULT 'daily',
  brief_prompt_context TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE mention_audience_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mention_id UUID NOT NULL REFERENCES mentions(id) ON DELETE CASCADE,
  audience_slug TEXT NOT NULL REFERENCES audiences(slug) ON DELETE CASCADE,
  routed_by TEXT NOT NULL CHECK (routed_by IN ('auto', 'manual')),
  routed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(mention_id, audience_slug)
);

CREATE TABLE audience_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_slug TEXT NOT NULL REFERENCES audiences(slug) ON DELETE CASCADE,
  brief_date DATE NOT NULL,
  full_brief TEXT NOT NULL,
  mention_count INTEGER DEFAULT 0,
  fire_count INTEGER DEFAULT 0,
  generated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(audience_slug, brief_date)
);

-- Indexes
CREATE INDEX idx_mar_mention ON mention_audience_routes(mention_id);
CREATE INDEX idx_mar_audience ON mention_audience_routes(audience_slug);
CREATE INDEX idx_ab_audience_date ON audience_briefs(audience_slug, brief_date DESC);

-- RLS
ALTER TABLE audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE mention_audience_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audience_briefs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "auth_read_audiences" ON audiences FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_manage_audiences" ON audiences FOR ALL TO service_role USING (true);

CREATE POLICY "auth_read_routes" ON mention_audience_routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_routes" ON mention_audience_routes FOR ALL TO authenticated USING (true);
CREATE POLICY "service_manage_routes" ON mention_audience_routes FOR ALL TO service_role USING (true);

CREATE POLICY "auth_read_audience_briefs" ON audience_briefs FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_manage_audience_briefs" ON audience_briefs FOR ALL TO service_role USING (true);

-- Updated_at trigger (function exists from 001_initial.sql)
CREATE TRIGGER update_audiences_updated_at
  BEFORE UPDATE ON audiences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed default audiences
INSERT INTO audiences (slug, display_name, description) VALUES
  ('comms', 'Comms', 'Communications team — sees all mentions'),
  ('product', 'Product', 'Feature requests, UX feedback, competitive feature gaps'),
  ('engineering', 'Engineering', 'Bugs, performance, reliability, infrastructure'),
  ('safety', 'Safety', 'Jailbreaks, model behavior, alignment discourse'),
  ('policy', 'Policy', 'Regulatory, government, compliance mentions'),
  ('executive', 'Executive', 'Major strategic events only');
