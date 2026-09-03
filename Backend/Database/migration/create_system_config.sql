-- Administrator-managed settings and a shared admission gate for invoice recognition.
CREATE TABLE IF NOT EXISTS otto_system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(value) = 'object'),
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO otto_system_config(key) VALUES ('invoice_recognition') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS otto_invoice_recognition_leases (
  id UUID PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invoice_recognition_lease_expiry ON otto_invoice_recognition_leases(expires_at);
ALTER TABLE otto_system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE otto_invoice_recognition_leases ENABLE ROW LEVEL SECURITY;
-- No anonymous policies: these tables are accessed by the server database role only.
