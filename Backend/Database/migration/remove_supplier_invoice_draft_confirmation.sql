-- Run in one transaction. Preserve all draft content and files; remove only the review stage.
UPDATE otto_supplier_invoice_drafts
SET status='ready', version=version+1, updated_at=now()
WHERE status='confirmed';

ALTER TABLE otto_supplier_invoice_drafts
  DROP CONSTRAINT IF EXISTS otto_supplier_invoice_drafts_status_check;
ALTER TABLE otto_supplier_invoice_drafts
  ADD CONSTRAINT otto_supplier_invoice_drafts_status_check
  CHECK (status IN ('queued','recognizing','ready','editing','saved','error'));
