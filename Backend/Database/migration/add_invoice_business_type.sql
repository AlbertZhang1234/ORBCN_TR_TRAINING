ALTER TABLE otto_invoices
  ADD COLUMN IF NOT EXISTS businesstype TEXT DEFAULT '03';

UPDATE otto_invoices
SET businesstype = '03'
WHERE businesstype IS NULL
   OR businesstype NOT IN ('01', '02', '03');

ALTER TABLE otto_invoices
  ALTER COLUMN businesstype SET DEFAULT '03',
  ALTER COLUMN businesstype SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'otto_invoices_businesstype_check'
  ) THEN
    ALTER TABLE otto_invoices
      ADD CONSTRAINT otto_invoices_businesstype_check
      CHECK (businesstype IN ('01', '02', '03'));
  END IF;
END $$;
