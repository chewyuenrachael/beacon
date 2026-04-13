-- LLM Output Monitoring tables

CREATE TABLE llm_probes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_text TEXT NOT NULL,
  category TEXT NOT NULL,
  target_entity TEXT NOT NULL DEFAULT 'anthropic',
  is_active BOOLEAN DEFAULT true,
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE llm_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  probe_id UUID NOT NULL REFERENCES llm_probes(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  response_text TEXT NOT NULL,
  model_version TEXT,
  response_date DATE NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(probe_id, platform, response_date)
);

CREATE TABLE llm_response_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES llm_responses(id) ON DELETE CASCADE UNIQUE,
  anthropic_mentioned BOOLEAN NOT NULL DEFAULT false,
  claude_mentioned BOOLEAN NOT NULL DEFAULT false,
  mention_sentiment INTEGER NOT NULL DEFAULT 0,
  mention_context TEXT,
  narratives_reflected JSONB DEFAULT '[]',
  competitors_mentioned JSONB DEFAULT '[]',
  competitors_favored JSONB DEFAULT '[]',
  anthropic_rank INTEGER,
  factual_errors JSONB DEFAULT '[]',
  has_critical_error BOOLEAN NOT NULL DEFAULT false,
  overall_score INTEGER NOT NULL DEFAULT 0,
  analysis_summary TEXT,
  classified_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE llm_monitoring_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  week_start DATE NOT NULL,
  total_probes INTEGER DEFAULT 0,
  total_responses INTEGER DEFAULT 0,
  anthropic_mention_rate REAL DEFAULT 0,
  avg_sentiment REAL DEFAULT 0,
  avg_rank REAL,
  avg_overall_score REAL DEFAULT 0,
  narrative_pull_through JSONB DEFAULT '{}',
  top_competitor TEXT,
  error_count INTEGER DEFAULT 0,
  factual_error_count INTEGER DEFAULT 0,
  critical_error_count INTEGER DEFAULT 0,
  snapshot_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(platform, week_start)
);

-- Indexes
CREATE INDEX idx_llm_responses_probe ON llm_responses(probe_id);
CREATE INDEX idx_llm_responses_platform ON llm_responses(platform);
CREATE INDEX idx_llm_responses_date ON llm_responses(response_date DESC);
CREATE INDEX idx_llm_classifications_response ON llm_response_classifications(response_id);
CREATE INDEX idx_llm_snapshots_platform_week ON llm_monitoring_snapshots(platform, week_start DESC);

-- RLS
ALTER TABLE llm_probes ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_response_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_monitoring_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_llm_probes" ON llm_probes FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_manage_llm_probes" ON llm_probes FOR ALL TO service_role USING (true);

CREATE POLICY "auth_read_llm_responses" ON llm_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_manage_llm_responses" ON llm_responses FOR ALL TO service_role USING (true);

CREATE POLICY "auth_read_llm_classifications" ON llm_response_classifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_manage_llm_classifications" ON llm_response_classifications FOR ALL TO service_role USING (true);

CREATE POLICY "auth_read_llm_snapshots" ON llm_monitoring_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_manage_llm_snapshots" ON llm_monitoring_snapshots FOR ALL TO service_role USING (true);
