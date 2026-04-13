-- Key-value settings table for Pulse configuration
CREATE TABLE IF NOT EXISTS pulse_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
