-- Unified original-file metadata for reimbursement and supplier invoices.
CREATE TABLE IF NOT EXISTS otto_invoice_attachments (
  id UUID PRIMARY KEY,
  invoiceno TEXT NOT NULL UNIQUE REFERENCES otto_invoices(invoiceno) ON DELETE CASCADE,
  storage_kind TEXT NOT NULL CHECK (storage_kind IN ('managed','legacy-invoice','legacy-supplier')),
  storage_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (storage_kind, storage_key)
);
CREATE INDEX IF NOT EXISTS idx_invoice_attachments_invoice ON otto_invoice_attachments(invoiceno);
ALTER TABLE otto_invoice_attachments ENABLE ROW LEVEL SECURITY;

-- Existing supplier drafts were stored in data/supplier-originals. New drafts
-- explicitly write "managed" after this migration is deployed.
ALTER TABLE otto_supplier_invoice_drafts
  ADD COLUMN IF NOT EXISTS storage_kind TEXT NOT NULL DEFAULT 'legacy-supplier'
  CHECK (storage_kind IN ('managed','legacy-supplier'));

INSERT INTO otto_invoice_attachments
  (id,invoiceno,storage_kind,storage_key,original_filename,content_type,file_size,created_at,updated_at)
SELECT id,saved_invoice_no,storage_kind,storage_key,filename,content_type,file_size,created_at,updated_at
FROM otto_supplier_invoice_drafts
WHERE status='saved' AND saved_invoice_no IS NOT NULL
ON CONFLICT (invoiceno) DO NOTHING;
