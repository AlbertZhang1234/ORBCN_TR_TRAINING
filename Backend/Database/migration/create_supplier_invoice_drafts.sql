-- Durable upload queue. File bytes live in persistent server storage.
CREATE TABLE IF NOT EXISTS otto_supplier_invoice_drafts (
  id UUID PRIMARY KEY,
  userid TEXT NOT NULL,
  filename TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','recognizing','ready','editing','confirmed','saved','error')),
  header JSONB NOT NULL DEFAULT '{}'::jsonb,
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  recognized_result JSONB,
  error TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  lease_token UUID,
  lease_until TIMESTAMPTZ,
  saved_invoice_no TEXT UNIQUE REFERENCES otto_invoices(invoiceno) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (header->>'businesstype' IN ('01','02'))
);
CREATE INDEX IF NOT EXISTS idx_supplier_drafts_user ON otto_supplier_invoice_drafts(userid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_drafts_queue ON otto_supplier_invoice_drafts(status, lease_until, created_at);
-- Access only through authenticated server services, never anonymous Supabase REST.
ALTER TABLE otto_supplier_invoice_drafts ENABLE ROW LEVEL SECURITY;
