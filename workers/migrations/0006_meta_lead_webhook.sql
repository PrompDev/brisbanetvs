-- Official Meta Lead Ads webhook queue and Automation Run Monitor cursor.
-- The queue stores Meta object IDs and delivery state only. Lead answers are
-- fetched from Graph API after signature verification and stored in the
-- canonical contacts/leads tables.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta_webhook_events (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL DEFAULT '',
  form_id TEXT NOT NULL DEFAULT '',
  ad_id TEXT NOT NULL DEFAULT '',
  created_time INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TEXT NOT NULL,
  last_error TEXT NOT NULL DEFAULT '',
  received_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_meta_webhook_events_pending
  ON meta_webhook_events(status, next_attempt_at, received_at);

CREATE INDEX IF NOT EXISTS idx_meta_webhook_events_updated
  ON meta_webhook_events(status, updated_at);

CREATE TABLE IF NOT EXISTS automation_monitor_state (
  monitor_key TEXT PRIMARY KEY,
  last_run_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
