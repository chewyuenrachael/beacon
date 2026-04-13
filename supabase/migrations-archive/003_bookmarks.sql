ALTER TABLE mentions ADD COLUMN IF NOT EXISTS is_bookmarked BOOLEAN DEFAULT FALSE;
ALTER TABLE mentions ADD COLUMN IF NOT EXISTS flag_type TEXT CHECK (
  flag_type IN ('draft_response', 'share_with_product', 'case_study', 'include_in_brief', NULL)
);

CREATE INDEX idx_mentions_bookmarked ON mentions(is_bookmarked) WHERE is_bookmarked = TRUE;
CREATE INDEX idx_mentions_flagged ON mentions(flag_type) WHERE flag_type IS NOT NULL;
