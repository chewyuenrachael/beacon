-- Narrative Command Center

CREATE TABLE narrative_priorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  target_pull_through REAL NOT NULL DEFAULT 0.5,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  quarter TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE mention_pull_through (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mention_id UUID NOT NULL REFERENCES mentions(id) ON DELETE CASCADE,
  narrative_slug TEXT NOT NULL REFERENCES narrative_priorities(slug) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 2),
  framing TEXT NOT NULL CHECK (framing IN ('gain', 'loss', 'neutral')) DEFAULT 'neutral',
  evidence TEXT,
  scored_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(mention_id, narrative_slug)
);

CREATE TABLE journalist_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  outlet TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  beat TEXT,
  email TEXT,
  twitter_handle TEXT,
  notes TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_coverage_at TIMESTAMPTZ,
  mention_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE journalist_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journalist_id UUID NOT NULL REFERENCES journalist_profiles(id) ON DELETE CASCADE,
  mention_id UUID NOT NULL REFERENCES mentions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(journalist_id, mention_id)
);

CREATE TABLE narrative_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  narrative_slug TEXT NOT NULL REFERENCES narrative_priorities(slug) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  total_press_mentions INTEGER DEFAULT 0,
  scored_mentions INTEGER DEFAULT 0,
  pull_through_count INTEGER DEFAULT 0,
  strong_pull_through_count INTEGER DEFAULT 0,
  pull_through_rate REAL DEFAULT 0,
  avg_framing_sentiment REAL DEFAULT 0,
  gain_count INTEGER DEFAULT 0,
  loss_count INTEGER DEFAULT 0,
  neutral_count INTEGER DEFAULT 0,
  top_outlet TEXT,
  top_journalist TEXT,
  snapshot_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(narrative_slug, week_start)
);

CREATE TABLE narrative_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_theme TEXT NOT NULL,
  description TEXT NOT NULL,
  mention_count INTEGER DEFAULT 0,
  first_detected_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  sample_mention_ids UUID[],
  status TEXT NOT NULL CHECK (status IN ('new', 'reviewing', 'adopted', 'dismissed')) DEFAULT 'new',
  recommendation TEXT,
  dismissed_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE narrative_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL UNIQUE,
  full_report TEXT NOT NULL,
  highlights JSONB,
  generated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_mpt_mention ON mention_pull_through(mention_id);
CREATE INDEX idx_mpt_narrative ON mention_pull_through(narrative_slug);
CREATE INDEX idx_mpt_scored_at ON mention_pull_through(scored_at DESC);
CREATE INDEX idx_jp_outlet ON journalist_profiles(outlet);
CREATE INDEX idx_jp_mentions ON journalist_profiles(mention_count DESC);
CREATE INDEX idx_jm_journalist ON journalist_mentions(journalist_id);
CREATE INDEX idx_jm_mention ON journalist_mentions(mention_id);
CREATE INDEX idx_ns_slug_week ON narrative_snapshots(narrative_slug, week_start DESC);
CREATE INDEX idx_ng_status ON narrative_gaps(status);
CREATE INDEX idx_nr_week ON narrative_reports(week_start DESC);

-- RLS
ALTER TABLE narrative_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE mention_pull_through ENABLE ROW LEVEL SECURITY;
ALTER TABLE journalist_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE journalist_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE narrative_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE narrative_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE narrative_reports ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "auth_read_narrative_priorities" ON narrative_priorities FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_manage_narrative_priorities" ON narrative_priorities FOR ALL TO service_role USING (true);

CREATE POLICY "auth_read_mpt" ON mention_pull_through FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_manage_mpt" ON mention_pull_through FOR ALL TO service_role USING (true);

CREATE POLICY "auth_read_journalists" ON journalist_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update_journalists" ON journalist_profiles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "service_manage_journalists" ON journalist_profiles FOR ALL TO service_role USING (true);

CREATE POLICY "auth_read_jm" ON journalist_mentions FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_manage_jm" ON journalist_mentions FOR ALL TO service_role USING (true);

CREATE POLICY "auth_read_snapshots" ON narrative_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_manage_snapshots" ON narrative_snapshots FOR ALL TO service_role USING (true);

CREATE POLICY "auth_read_gaps" ON narrative_gaps FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_manage_gaps" ON narrative_gaps FOR ALL TO service_role USING (true);

CREATE POLICY "auth_read_reports" ON narrative_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_manage_reports" ON narrative_reports FOR ALL TO service_role USING (true);

-- Updated_at triggers
CREATE TRIGGER update_narrative_priorities_updated_at
  BEFORE UPDATE ON narrative_priorities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journalist_profiles_updated_at
  BEFORE UPDATE ON journalist_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed default narrative priorities
INSERT INTO narrative_priorities (slug, display_name, description, target_pull_through, sort_order) VALUES
  ('safety-leadership', 'Safety Leadership', 'Anthropic leads responsible AI development', 0.5, 1),
  ('developer-empowerment', 'Developer Empowerment', 'Claude Code makes developers more productive', 0.5, 2),
  ('research-excellence', 'Research Excellence', 'World-class AI research advancing the field', 0.5, 3),
  ('enterprise-trust', 'Enterprise Trust', 'Trusted by enterprises for production AI workloads', 0.5, 4),
  ('ecosystem-growth', 'Ecosystem Growth', 'Thriving developer ecosystem building on Claude', 0.5, 5),
  ('transparency-openness', 'Transparency & Openness', 'Open about capabilities, limitations, and approach', 0.5, 6);
