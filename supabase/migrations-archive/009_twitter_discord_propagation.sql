-- ============================================================
-- PULSE — Twitter/Discord ingestion + Propagation detection
-- ============================================================

-- 1. Expand mentions source CHECK to include twitter, discord
-- ============================================================

ALTER TABLE mentions DROP CONSTRAINT IF EXISTS mentions_source_check;
ALTER TABLE mentions ADD CONSTRAINT mentions_source_check
  CHECK (source IN ('hackernews', 'reddit', 'youtube', 'rss', 'manual', 'twitter', 'discord'));

-- 2. Twitter monitored accounts
-- ============================================================

CREATE TABLE twitter_monitored_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  twitter_user_id TEXT,
  display_name TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  is_active BOOLEAN DEFAULT true,
  last_tweet_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE twitter_monitored_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_twitter_accounts"
  ON twitter_monitored_accounts FOR ALL TO service_role USING (true);
CREATE POLICY "auth_read_twitter_accounts"
  ON twitter_monitored_accounts FOR SELECT TO authenticated USING (true);

-- Seed monitored accounts
INSERT INTO twitter_monitored_accounts (username, display_name, category) VALUES
  ('AnthropicAI', 'Anthropic', 'anthropic-official'),
  ('alexalbert__', 'Alex Albert', 'anthropic-official'),
  ('daborga', 'Dario Amodei', 'anthropic-official');

-- 3. Discord monitored channels
-- ============================================================

CREATE TABLE discord_monitored_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id TEXT NOT NULL,
  server_name TEXT,
  channel_id TEXT NOT NULL UNIQUE,
  channel_name TEXT,
  category TEXT DEFAULT 'community',
  is_active BOOLEAN DEFAULT true,
  last_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE discord_monitored_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_discord_channels"
  ON discord_monitored_channels FOR ALL TO service_role USING (true);
CREATE POLICY "auth_read_discord_channels"
  ON discord_monitored_channels FOR SELECT TO authenticated USING (true);

-- Seed placeholder (operator must configure real IDs)
INSERT INTO discord_monitored_channels (server_id, server_name, channel_id, channel_name, category) VALUES
  ('CONFIGURE_ME', 'Claude Discord', 'CONFIGURE_ME', 'general', 'community');

-- 4. Propagation clusters
-- ============================================================

CREATE TABLE propagation_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  cluster_keywords TEXT[] NOT NULL DEFAULT '{}',
  first_platform TEXT NOT NULL,
  platforms_reached TEXT[] NOT NULL DEFAULT '{}',
  total_engagement INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE propagation_cluster_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID NOT NULL REFERENCES propagation_clusters(id) ON DELETE CASCADE,
  mention_id UUID NOT NULL REFERENCES mentions(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cluster_id, mention_id)
);

-- Indexes
CREATE INDEX idx_prop_clusters_active ON propagation_clusters(is_active) WHERE is_active = true;
CREATE INDEX idx_prop_cluster_mentions_cluster ON propagation_cluster_mentions(cluster_id);
CREATE INDEX idx_prop_cluster_mentions_mention ON propagation_cluster_mentions(mention_id);

-- RLS
ALTER TABLE propagation_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE propagation_cluster_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_prop_clusters"
  ON propagation_clusters FOR ALL TO service_role USING (true);
CREATE POLICY "auth_read_prop_clusters"
  ON propagation_clusters FOR SELECT TO authenticated USING (true);

CREATE POLICY "service_all_prop_cluster_mentions"
  ON propagation_cluster_mentions FOR ALL TO service_role USING (true);
CREATE POLICY "auth_read_prop_cluster_mentions"
  ON propagation_cluster_mentions FOR SELECT TO authenticated USING (true);

-- updated_at trigger (reuses existing function from 001_initial.sql)
CREATE TRIGGER update_propagation_clusters_updated_at
  BEFORE UPDATE ON propagation_clusters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
