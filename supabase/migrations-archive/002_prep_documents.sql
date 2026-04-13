-- ============================================================
-- PULSE — Spokesperson Prep Documents
-- ============================================================

CREATE TABLE prep_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  journalist_name TEXT NOT NULL,
  outlet TEXT NOT NULL,
  topic TEXT NOT NULL,
  engagement_date DATE NOT NULL,
  engagement_type TEXT NOT NULL CHECK (engagement_type IN ('podcast', 'print', 'broadcast', 'panel', 'briefing', 'other')),
  spokesperson TEXT NOT NULL,
  notes TEXT,
  document TEXT NOT NULL,
  mention_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prep_documents_created ON prep_documents(created_at DESC);

ALTER TABLE prep_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_preps" ON prep_documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_preps" ON prep_documents
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "service_manage_preps" ON prep_documents
  FOR ALL TO service_role USING (true);
