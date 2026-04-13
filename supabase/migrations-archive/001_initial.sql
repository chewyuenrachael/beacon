-- ============================================================
-- PULSE — Initial Schema
-- ============================================================

-- 1. TABLES
-- ============================================================

CREATE TABLE mentions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Source identification
  source TEXT NOT NULL CHECK (source IN ('hackernews', 'reddit', 'youtube', 'rss', 'manual')),
  source_id TEXT NOT NULL,
  source_url TEXT NOT NULL,

  -- Content
  title TEXT,
  body TEXT,
  author TEXT,
  author_karma INTEGER,
  engagement_score INTEGER DEFAULT 0,

  -- Timestamps
  published_at TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  classified_at TIMESTAMPTZ,

  -- Classification: urgency + action
  urgency TEXT CHECK (urgency IN ('fire', 'moment', 'signal', 'noise')),
  urgency_reason TEXT,
  summary TEXT,
  recommended_action TEXT,

  -- Classification: emotion
  hope_score SMALLINT DEFAULT 0 CHECK (hope_score BETWEEN 0 AND 3),
  concern_score SMALLINT DEFAULT 0 CHECK (concern_score BETWEEN 0 AND 3),
  tension_type TEXT CHECK (tension_type IN (
    'learning_vs_atrophy',
    'time_savings_vs_treadmill',
    'empowerment_vs_displacement',
    'decision_support_vs_erosion',
    'productivity_vs_dependency',
    'none'
  )),
  primary_emotion TEXT,

  -- Classification: meta
  is_competitor_mention BOOLEAN DEFAULT FALSE,
  competitor_names TEXT[],
  credibility_signal TEXT CHECK (credibility_signal IN ('high', 'medium', 'low', 'unknown')),
  topics TEXT[],
  inferred_region TEXT,

  -- Velocity tracking
  velocity_status TEXT CHECK (velocity_status IN ('accelerating', 'normal', 'decelerating', 'stale')) DEFAULT 'normal',
  velocity_score REAL DEFAULT 0,

  -- Review tracking
  is_reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,

  -- Raw data
  raw_json JSONB,
  classification_raw JSONB,

  -- Deduplication
  UNIQUE(source, source_id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE engagement_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mention_id UUID NOT NULL REFERENCES mentions(id) ON DELETE CASCADE,
  engagement_score INTEGER NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE daily_briefs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brief_date DATE NOT NULL UNIQUE,

  fires_section TEXT,
  moments_section TEXT,
  signals_section TEXT,
  competitor_section TEXT,
  tension_section TEXT,
  stats_section TEXT,

  full_brief TEXT NOT NULL,

  mention_count INTEGER,
  fire_count INTEGER,
  moment_count INTEGER,
  tension_count INTEGER,

  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE keywords (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('primary', 'competitor', 'context')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ingestion_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  mentions_found INTEGER DEFAULT 0,
  mentions_new INTEGER DEFAULT 0,
  mentions_classified INTEGER DEFAULT 0,
  error TEXT,
  duration_ms INTEGER
);

-- 2. INDEXES
-- ============================================================

-- Mentions indexes
CREATE INDEX idx_mentions_urgency ON mentions(urgency);
CREATE INDEX idx_mentions_source ON mentions(source);
CREATE INDEX idx_mentions_published ON mentions(published_at DESC);
CREATE INDEX idx_mentions_hope_concern ON mentions(hope_score, concern_score);
CREATE INDEX idx_mentions_tension ON mentions(tension_type) WHERE tension_type != 'none';
CREATE INDEX idx_mentions_velocity ON mentions(velocity_status) WHERE velocity_status = 'accelerating';
CREATE INDEX idx_mentions_competitor ON mentions(is_competitor_mention) WHERE is_competitor_mention = TRUE;
CREATE INDEX idx_mentions_unreviewed ON mentions(is_reviewed) WHERE is_reviewed = FALSE;
CREATE INDEX idx_mentions_region ON mentions(inferred_region) WHERE inferred_region IS NOT NULL;

-- Engagement snapshots indexes
CREATE INDEX idx_snapshots_mention ON engagement_snapshots(mention_id);
CREATE INDEX idx_snapshots_time ON engagement_snapshots(snapshot_at DESC);

-- 3. UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_mentions_updated_at
  BEFORE UPDATE ON mentions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_logs ENABLE ROW LEVEL SECURITY;

-- Mentions policies
CREATE POLICY "auth_read_mentions" ON mentions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update_mentions" ON mentions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "service_insert_mentions" ON mentions FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "service_update_mentions" ON mentions FOR UPDATE TO service_role USING (true);

-- Engagement snapshots policies
CREATE POLICY "service_manage_snapshots" ON engagement_snapshots FOR ALL TO service_role USING (true);
CREATE POLICY "auth_read_snapshots" ON engagement_snapshots FOR SELECT TO authenticated USING (true);

-- Daily briefs policies
CREATE POLICY "auth_read_briefs" ON daily_briefs FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_insert_briefs" ON daily_briefs FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "service_upsert_briefs" ON daily_briefs FOR UPDATE TO service_role USING (true);

-- Keywords policies
CREATE POLICY "auth_manage_keywords" ON keywords FOR ALL TO authenticated USING (true);

-- Ingestion logs policies
CREATE POLICY "auth_read_logs" ON ingestion_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_manage_logs" ON ingestion_logs FOR ALL TO service_role USING (true);

-- 5. SEED DATA
-- ============================================================

INSERT INTO keywords (keyword, category) VALUES
  ('claude code', 'primary'),
  ('claude agent', 'primary'),
  ('anthropic', 'primary'),
  ('claude sonnet', 'primary'),
  ('claude opus', 'primary'),
  ('cursor ai', 'competitor'),
  ('github copilot', 'competitor'),
  ('windsurf', 'competitor'),
  ('devin ai', 'competitor'),
  ('replit agent', 'competitor'),
  ('augment code', 'competitor'),
  ('agentic coding', 'context'),
  ('ai coding assistant', 'context');
