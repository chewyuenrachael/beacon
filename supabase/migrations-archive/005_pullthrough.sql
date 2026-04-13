-- Pull-through scoring: measures whether key messages land in press coverage

CREATE TABLE key_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  shorthand TEXT NOT NULL,
  category TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pullthrough_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mention_id UUID NOT NULL REFERENCES mentions(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES key_messages(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 2),
  evidence TEXT,
  scored_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(mention_id, message_id)
);

CREATE INDEX idx_pullthrough_mention ON pullthrough_scores(mention_id);
CREATE INDEX idx_pullthrough_message ON pullthrough_scores(message_id);
CREATE INDEX idx_pullthrough_score ON pullthrough_scores(score);

ALTER TABLE key_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pullthrough_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access" ON key_messages FOR ALL USING (true);
CREATE POLICY "Allow service role full access" ON pullthrough_scores FOR ALL USING (true);
