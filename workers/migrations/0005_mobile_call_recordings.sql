-- Private Pixel call-recording intake. Pairing codes and device tokens are
-- stored only as SHA-256 hashes. Audio remains in the private CALL_RECORDINGS
-- R2 bucket; D1 stores opaque object keys and the lead/call relationship.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS mobile_call_pairings (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mobile_call_pairings_expiry
  ON mobile_call_pairings(expires_at);

CREATE TABLE IF NOT EXISTS mobile_call_devices (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  owner_email TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  last_used_at TEXT NOT NULL DEFAULT '',
  revoked_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mobile_call_devices_active
  ON mobile_call_devices(active, revoked_at);

CREATE TABLE IF NOT EXISTS ops_call_recordings (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES ops_calls(id) ON DELETE CASCADE,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE RESTRICT,
  object_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 104857600),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  source TEXT NOT NULL DEFAULT 'pixel_phone_share'
    CHECK (source IN ('pixel_phone_share', 'provider')),
  consent_confirmed_at TEXT NOT NULL,
  uploaded_by_device_id TEXT REFERENCES mobile_call_devices(id) ON DELETE SET NULL,
  client_upload_id TEXT NOT NULL,
  retention_until TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_call_recordings_device_upload
  ON ops_call_recordings(uploaded_by_device_id, client_upload_id)
  WHERE uploaded_by_device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ops_call_recordings_lead_created
  ON ops_call_recordings(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_call_recordings_retention
  ON ops_call_recordings(retention_until);

CREATE TRIGGER IF NOT EXISTS trg_ops_call_recordings_call_lead_insert
BEFORE INSERT ON ops_call_recordings
WHEN NOT EXISTS (
  SELECT 1 FROM ops_calls c
  WHERE c.id = NEW.call_id AND c.lead_id = NEW.lead_id
)
BEGIN
  SELECT RAISE(ABORT, 'recording_call_lead_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_ops_call_recordings_call_lead_update
BEFORE UPDATE OF call_id, lead_id ON ops_call_recordings
WHEN NOT EXISTS (
  SELECT 1 FROM ops_calls c
  WHERE c.id = NEW.call_id AND c.lead_id = NEW.lead_id
)
BEGIN
  SELECT RAISE(ABORT, 'recording_call_lead_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_ops_calls_recording_lead_parent_update
BEFORE UPDATE OF lead_id ON ops_calls
WHEN EXISTS (
  SELECT 1 FROM ops_call_recordings r
  WHERE r.call_id = OLD.id AND r.lead_id <> NEW.lead_id
)
BEGIN
  SELECT RAISE(ABORT, 'call_recording_lead_mismatch');
END;
