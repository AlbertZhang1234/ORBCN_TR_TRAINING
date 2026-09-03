CREATE TABLE IF NOT EXISTS otto_invoice_lines (
  invoiceno TEXT NOT NULL,
  seqno INTEGER NOT NULL CHECK (seqno > 0),
  description TEXT NOT NULL DEFAULT '',
  spec_model TEXT,
  unit_price NUMERIC,
  quantity NUMERIC,
  amount_excl_tax NUMERIC,
  tax_rate TEXT,
  amount_incl_tax NUMERIC,
  PRIMARY KEY (invoiceno, seqno),
  CONSTRAINT fk_invoice_line_invoice
    FOREIGN KEY (invoiceno)
    REFERENCES otto_invoices(invoiceno)
    ON DELETE CASCADE
);
