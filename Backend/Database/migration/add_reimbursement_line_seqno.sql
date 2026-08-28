ALTER TABLE otto_tr_t
  ADD COLUMN IF NOT EXISTS seqno INTEGER;

WITH ranked_lines AS (
  SELECT
    id,
    invoiceno,
    ROW_NUMBER() OVER (PARTITION BY id ORDER BY invoiceno)::INTEGER AS next_seqno
  FROM otto_tr_t
)
UPDATE otto_tr_t AS line
SET seqno = ranked.next_seqno
FROM ranked_lines AS ranked
WHERE line.id = ranked.id
  AND line.invoiceno = ranked.invoiceno
  AND line.seqno IS NULL;

ALTER TABLE otto_tr_t
  ALTER COLUMN seqno SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'otto_tr_t_id_seqno_key'
      AND conrelid = 'otto_tr_t'::regclass
  ) THEN
    ALTER TABLE otto_tr_t
      ADD CONSTRAINT otto_tr_t_id_seqno_key UNIQUE (id, seqno);
  END IF;
END $$;
