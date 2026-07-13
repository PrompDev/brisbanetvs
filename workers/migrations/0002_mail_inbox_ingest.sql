-- Adds only metadata required by the future Cloudflare Email Routing worker.
-- Raw MIME remains in the dedicated private R2 bucket, never in D1.

ALTER TABLE mail_messages ADD COLUMN raw_object_key TEXT NOT NULL DEFAULT '';
ALTER TABLE mail_messages ADD COLUMN message_id TEXT NOT NULL DEFAULT '';
ALTER TABLE mail_messages ADD COLUMN in_reply_to TEXT NOT NULL DEFAULT '';
ALTER TABLE mail_messages ADD COLUMN references_header TEXT NOT NULL DEFAULT '';
ALTER TABLE mail_messages ADD COLUMN attachment_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mail_messages ADD COLUMN size_bytes INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_mail_messages_status_received_at
  ON mail_messages(status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_mail_messages_message_id
  ON mail_messages(message_id);
