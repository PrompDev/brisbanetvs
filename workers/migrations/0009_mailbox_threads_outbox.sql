-- Locks the Operations inbox to the three approved Brisbane TVs aliases and
-- prepares thread-safe drafts plus an idempotent future sending queue.

ALTER TABLE mail_messages ADD COLUMN mailbox_address TEXT NOT NULL DEFAULT '';
ALTER TABLE mail_messages ADD COLUMN read_at TEXT;
ALTER TABLE mail_messages ADD COLUMN ingest_key TEXT NOT NULL DEFAULT '';
ALTER TABLE mail_messages ADD COLUMN reply_to_address TEXT NOT NULL DEFAULT '';
ALTER TABLE mail_messages ADD COLUMN envelope_from_address TEXT NOT NULL DEFAULT '';

UPDATE mail_messages
SET mailbox_address = lower(to_address)
WHERE direction = 'inbound' AND mailbox_address = '';

CREATE INDEX IF NOT EXISTS idx_mail_messages_mailbox_status_received
  ON mail_messages(mailbox_address, status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_mail_messages_mailbox_thread_received
  ON mail_messages(mailbox_address, thread_id, received_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mail_messages_ingest_key
  ON mail_messages(ingest_key)
  WHERE ingest_key <> '';

ALTER TABLE mail_drafts ADD COLUMN from_address TEXT NOT NULL DEFAULT 'deandre@brisbanetvs.com';
ALTER TABLE mail_drafts ADD COLUMN thread_id TEXT NOT NULL DEFAULT '';
ALTER TABLE mail_drafts ADD COLUMN reply_to_message_id TEXT NOT NULL DEFAULT '';
ALTER TABLE mail_drafts ADD COLUMN updated_by TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_mail_drafts_from_status_updated
  ON mail_drafts(from_address, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS mail_outbox (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL UNIQUE REFERENCES mail_drafts(id) ON DELETE RESTRICT,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  plain_text TEXT NOT NULL DEFAULT '',
  thread_id TEXT NOT NULL DEFAULT '',
  in_reply_to TEXT NOT NULL DEFAULT '',
  references_header TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'cancelled')),
  requested_by TEXT NOT NULL DEFAULT '',
  requested_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT NOT NULL DEFAULT '',
  safe_error_code TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_mail_outbox_status_requested
  ON mail_outbox(status, requested_at);
