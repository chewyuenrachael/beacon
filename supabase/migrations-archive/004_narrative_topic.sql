-- Add narrative theme column to mentions
ALTER TABLE mentions ADD COLUMN IF NOT EXISTS topic TEXT CHECK (
  topic IN (
    'safety-alignment',
    'developer-experience',
    'enterprise-adoption',
    'competitive-positioning',
    'pricing-access',
    'open-source-ecosystem',
    'regulation-policy'
  )
);

-- Index for topic-based queries (brief stats, prep filtering)
CREATE INDEX IF NOT EXISTS idx_mentions_topic ON mentions(topic) WHERE topic IS NOT NULL;
