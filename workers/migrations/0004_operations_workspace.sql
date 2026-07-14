-- Additive operations workspace tables. Canonical customer and enquiry data
-- remains in contacts/leads; these tables contain only operational records.
-- This migration intentionally creates no sample or seed records.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ops_calls (
  id TEXT PRIMARY KEY,
  lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT '',
  provider_call_id TEXT NOT NULL DEFAULT '',
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('ringing', 'answered', 'completed', 'missed', 'failed', 'cancelled')),
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  recording_object_key TEXT NOT NULL DEFAULT '',
  transcript TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  sentiment TEXT NOT NULL DEFAULT 'unknown'
    CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed', 'unknown')),
  outcome TEXT NOT NULL DEFAULT '',
  follow_up TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_calls_provider_id
  ON ops_calls(provider, provider_call_id)
  WHERE provider <> '' AND provider_call_id <> '';
CREATE INDEX IF NOT EXISTS idx_ops_calls_lead_started
  ON ops_calls(lead_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_calls_started
  ON ops_calls(started_at DESC);

CREATE TABLE IF NOT EXISTS ops_quotes (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'needs_review', 'approved', 'sent', 'accepted', 'declined', 'expired', 'cancelled')),
  subtotal_cents INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
  gst_cents INTEGER NOT NULL DEFAULT 0 CHECK (gst_cents >= 0),
  total_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  deposit_cents INTEGER NOT NULL DEFAULT 0 CHECK (deposit_cents >= 0),
  items_json TEXT NOT NULL DEFAULT '[]',
  package_id TEXT NOT NULL DEFAULT '',
  tv_size TEXT NOT NULL DEFAULT '',
  brand_model TEXT NOT NULL DEFAULT '',
  wall_type TEXT NOT NULL DEFAULT '',
  bracket_status TEXT NOT NULL DEFAULT '',
  cable_route TEXT NOT NULL DEFAULT '',
  access_notes TEXT NOT NULL DEFAULT '',
  suburb TEXT NOT NULL DEFAULT '',
  postcode TEXT NOT NULL DEFAULT '',
  preferred_day TEXT NOT NULL DEFAULT '',
  photo_status TEXT NOT NULL DEFAULT 'none'
    CHECK (photo_status IN ('none', 'requested', 'received', 'reviewed')),
  review_flags_json TEXT NOT NULL DEFAULT '[]',
  valid_until TEXT NOT NULL DEFAULT '',
  sent_at TEXT NOT NULL DEFAULT '',
  accepted_at TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_quotes_lead_created
  ON ops_quotes(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_quotes_status_created
  ON ops_quotes(status, created_at DESC);

CREATE TABLE IF NOT EXISTS ops_jobs (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE RESTRICT,
  quote_id TEXT REFERENCES ops_quotes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'tentative'
    CHECK (status IN ('tentative', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  scheduled_at TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  installer TEXT NOT NULL DEFAULT '',
  revenue_cents INTEGER NOT NULL DEFAULT 0 CHECK (revenue_cents >= 0),
  labour_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (labour_cost_cents >= 0),
  material_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (material_cost_cents >= 0),
  notes TEXT NOT NULL DEFAULT '',
  completed_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_jobs_lead_scheduled
  ON ops_jobs(lead_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_jobs_status_scheduled
  ON ops_jobs(status, scheduled_at);

CREATE TRIGGER IF NOT EXISTS trg_ops_jobs_quote_lead_insert
BEFORE INSERT ON ops_jobs
WHEN NEW.quote_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ops_quotes q
    WHERE q.id = NEW.quote_id AND q.lead_id = NEW.lead_id
  )
BEGIN
  SELECT RAISE(ABORT, 'job_quote_lead_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_ops_jobs_quote_lead_update
BEFORE UPDATE OF lead_id, quote_id ON ops_jobs
WHEN NEW.quote_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ops_quotes q
    WHERE q.id = NEW.quote_id AND q.lead_id = NEW.lead_id
  )
BEGIN
  SELECT RAISE(ABORT, 'job_quote_lead_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_ops_quotes_lead_parent_update
BEFORE UPDATE OF lead_id ON ops_quotes
WHEN EXISTS (
  SELECT 1 FROM ops_jobs j
  WHERE j.quote_id = OLD.id AND j.lead_id <> NEW.lead_id
)
BEGIN
  SELECT RAISE(ABORT, 'quote_job_lead_mismatch');
END;

CREATE TABLE IF NOT EXISTS ops_invoices (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES ops_jobs(id) ON DELETE SET NULL,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE RESTRICT,
  number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'issued', 'deposit_paid', 'partially_paid', 'paid', 'overdue', 'void')),
  total_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  paid_cents INTEGER NOT NULL DEFAULT 0 CHECK (paid_cents >= 0 AND paid_cents <= total_cents),
  payment_provider TEXT NOT NULL DEFAULT '',
  provider_payment_id TEXT NOT NULL DEFAULT '',
  due_at TEXT NOT NULL DEFAULT '',
  issued_at TEXT NOT NULL DEFAULT '',
  paid_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_invoices_provider_id
  ON ops_invoices(payment_provider, provider_payment_id)
  WHERE payment_provider <> '' AND provider_payment_id <> '';
CREATE INDEX IF NOT EXISTS idx_ops_invoices_lead_created
  ON ops_invoices(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_invoices_status_due
  ON ops_invoices(status, due_at);

CREATE TRIGGER IF NOT EXISTS trg_ops_invoices_job_lead_insert
BEFORE INSERT ON ops_invoices
WHEN NEW.job_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ops_jobs j
    WHERE j.id = NEW.job_id AND j.lead_id = NEW.lead_id
  )
BEGIN
  SELECT RAISE(ABORT, 'invoice_job_lead_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_ops_invoices_job_lead_update
BEFORE UPDATE OF lead_id, job_id ON ops_invoices
WHEN NEW.job_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ops_jobs j
    WHERE j.id = NEW.job_id AND j.lead_id = NEW.lead_id
  )
BEGIN
  SELECT RAISE(ABORT, 'invoice_job_lead_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_ops_jobs_lead_parent_update
BEFORE UPDATE OF lead_id ON ops_jobs
WHEN EXISTS (
  SELECT 1 FROM ops_invoices i
  WHERE i.job_id = OLD.id AND i.lead_id <> NEW.lead_id
)
BEGIN
  SELECT RAISE(ABORT, 'job_invoice_lead_mismatch');
END;

CREATE TABLE IF NOT EXISTS ops_activities (
  id TEXT PRIMARY KEY,
  lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL DEFAULT '',
  subject_type TEXT NOT NULL DEFAULT '',
  subject_id TEXT NOT NULL DEFAULT '',
  due_at TEXT NOT NULL DEFAULT '',
  completed_at TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_activities_lead_occurred
  ON ops_activities(lead_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_activities_open_followups
  ON ops_activities(due_at)
  WHERE activity_type = 'follow_up' AND completed_at = '';

CREATE TABLE IF NOT EXISTS ops_supplies (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  on_hand INTEGER NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reorder_level INTEGER NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  unit_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_cost_cents >= 0),
  supplier TEXT NOT NULL DEFAULT '',
  storage_location TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_supplies_category_name
  ON ops_supplies(category, name);

CREATE TABLE IF NOT EXISTS ops_supplier_products (
  id TEXT PRIMARY KEY,
  supplier TEXT NOT NULL,
  provider_product_id TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  bracket_type TEXT NOT NULL DEFAULT '',
  min_size INTEGER CHECK (min_size IS NULL OR min_size >= 0),
  max_size INTEGER CHECK (max_size IS NULL OR max_size >= 0),
  max_weight_kg INTEGER CHECK (max_weight_kg IS NULL OR max_weight_kg >= 0),
  vesa TEXT NOT NULL DEFAULT '',
  price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
  availability TEXT NOT NULL DEFAULT 'unknown'
    CHECK (availability IN ('unknown', 'available', 'unavailable', 'listed')),
  product_url TEXT NOT NULL DEFAULT '',
  approved INTEGER NOT NULL DEFAULT 0 CHECK (approved IN (0, 1)),
  last_checked_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_supplier_products_provider_id
  ON ops_supplier_products(supplier, provider_product_id)
  WHERE supplier <> '' AND provider_product_id <> '';
CREATE INDEX IF NOT EXISTS idx_ops_supplier_products_approved_name
  ON ops_supplier_products(approved DESC, supplier, name);

CREATE TABLE IF NOT EXISTS ops_social_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  platforms_json TEXT NOT NULL DEFAULT '[]',
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'scheduled', 'published', 'failed', 'cancelled')),
  campaign TEXT NOT NULL DEFAULT '',
  asset_object_key TEXT NOT NULL DEFAULT '',
  provider_post_ids_json TEXT NOT NULL DEFAULT '{}',
  error TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  published_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_social_posts_status_scheduled
  ON ops_social_posts(status, scheduled_at);

CREATE TABLE IF NOT EXISTS ops_sms_queue (
  id TEXT PRIMARY KEY,
  lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'queued', 'sent', 'delivered', 'failed', 'cancelled')),
  drafted_by TEXT NOT NULL DEFAULT '',
  approved_by TEXT NOT NULL DEFAULT '',
  gateway TEXT NOT NULL DEFAULT '',
  provider_message_id TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  approved_at TEXT NOT NULL DEFAULT '',
  sent_at TEXT NOT NULL DEFAULT '',
  delivered_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_sms_provider_id
  ON ops_sms_queue(gateway, provider_message_id)
  WHERE gateway <> '' AND provider_message_id <> '';
CREATE INDEX IF NOT EXISTS idx_ops_sms_lead_created
  ON ops_sms_queue(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_sms_status_created
  ON ops_sms_queue(status, created_at DESC);
