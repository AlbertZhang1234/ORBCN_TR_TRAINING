import { query, queryOne } from '../../lib/db';
import { ServiceError } from '../_core/error';
import { TABLES } from '../_core/tables';
import type { RequestAuthContext } from './requestAuth';

export interface RecognizedInvoiceLineInput {
  line_no?: number;
  description?: string;
  spec_model?: string;
  unit_price?: number | null;
  quantity?: number | null;
  amount_excl_tax?: number | null;
  tax_rate?: string;
  amount_incl_tax?: number | null;
}

interface InvoiceAccessRow {
  invoiceno: string;
  userid?: string;
  status?: string;
}

interface StoredInvoiceLine {
  invoiceno: string;
  seqno: number;
  description: string;
  spec_model: string | null;
  unit_price: number | null;
  quantity: number | null;
  amount_excl_tax: number | null;
  tax_rate: string | null;
  amount_incl_tax: number | null;
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeRecognizedInvoiceLines(
  lineItems: RecognizedInvoiceLineInput[],
): Array<Omit<StoredInvoiceLine, 'invoiceno'>> {
  const usedSequenceNumbers = new Set<number>();
  return lineItems.map((item, index) => {
    let seqno = Number.isInteger(item.line_no) && Number(item.line_no) > 0
      ? Number(item.line_no)
      : index + 1;
    while (usedSequenceNumbers.has(seqno)) seqno += 1;
    usedSequenceNumbers.add(seqno);

    return {
      seqno,
      description: text(item.description),
      spec_model: text(item.spec_model) || null,
      unit_price: nullableNumber(item.unit_price),
      quantity: nullableNumber(item.quantity),
      amount_excl_tax: nullableNumber(item.amount_excl_tax),
      tax_rate: text(item.tax_rate) || null,
      amount_incl_tax: nullableNumber(item.amount_incl_tax),
    };
  });
}

function assertInvoiceLineWriteAllowed(
  auth: RequestAuthContext,
  invoice: InvoiceAccessRow,
): void {
  const status = text(invoice.status).toUpperCase();
  if (status === 'SUBMITTED' || status === 'BOOKED') {
    throw new ServiceError(`Invoice ${invoice.invoiceno} cannot be changed`, { status: 409 });
  }
  if (!auth.permissions.isAdmin && !auth.permissions.isFinance) {
    if (text(invoice.userid).toLowerCase() !== text(auth.userid).toLowerCase()) {
      throw new ServiceError('Cannot modify invoice lines of another user', { status: 403 });
    }
  }
}

export async function replaceRecognizedInvoiceLines(
  auth: RequestAuthContext,
  invoiceNo: string,
  lineItems: RecognizedInvoiceLineInput[],
): Promise<StoredInvoiceLine[]> {
  const normalizedInvoiceNo = text(invoiceNo);
  if (!normalizedInvoiceNo) {
    throw new ServiceError('invoiceno is required', { status: 400 });
  }
  if (!Array.isArray(lineItems)) {
    throw new ServiceError('lineItems must be an array', { status: 400 });
  }

  const invoice = await queryOne<InvoiceAccessRow>(
    `SELECT invoiceno, userid, status
       FROM "${TABLES.invoice}"
      WHERE invoiceno = $1
      LIMIT 1`,
    [normalizedInvoiceNo],
  );
  if (!invoice) {
    throw new ServiceError(`Invoice ${normalizedInvoiceNo} not found`, { status: 404 });
  }
  assertInvoiceLineWriteAllowed(auth, invoice);

  const normalizedLines = normalizeRecognizedInvoiceLines(lineItems);
  return query<StoredInvoiceLine>(
    `WITH deleted AS (
       DELETE FROM "${TABLES.invoiceLine}" WHERE invoiceno = $1
     ), source AS (
       SELECT *
         FROM jsonb_to_recordset($2::jsonb) AS item(
           seqno INTEGER,
           description TEXT,
           spec_model TEXT,
           unit_price NUMERIC,
           quantity NUMERIC,
           amount_excl_tax NUMERIC,
           tax_rate TEXT,
           amount_incl_tax NUMERIC
         )
     )
     INSERT INTO "${TABLES.invoiceLine}" (
       invoiceno, seqno, description, spec_model, unit_price, quantity,
       amount_excl_tax, tax_rate, amount_incl_tax
     )
     SELECT $1, seqno, description, spec_model, unit_price, quantity,
            amount_excl_tax, tax_rate, amount_incl_tax
       FROM source
     RETURNING *`,
    [normalizedInvoiceNo, JSON.stringify(normalizedLines)],
  );
}
