import type pg from 'pg';
import { ServiceError } from '../_core/error';
import { TABLES } from '../_core/tables';
import type { RequestAuthContext } from './requestAuth';
import {
  normalizeRecognizedInvoiceLines,
  type RecognizedInvoiceLineInput,
} from './invoiceLines';

export interface SupplierInvoiceHeaderInput {
  invoiceno?: string;
  invoicedate?: string;
  supplier?: string;
  description?: string;
  comment?: string;
  bookingcode?: string;
  businesstype?: string;
  currency?: string;
  totalnetamount?: number | null;
  taxamount?: number | null;
  grossamount?: number | null;
}

interface StoredHeader extends pg.QueryResultRow {
  invoiceno: string;
  userid: string;
  businesstype: string;
}

const SUPPLIER_TYPES = new Set(['01', '02']);
const clean = (value: unknown) => String(value ?? '').trim();

export interface SupplierInvoiceRecognitionDependencies {
  withTransaction: <T>(work: (client: pg.PoolClient) => Promise<T>) => Promise<T>;
}

function optionalNumber(value: unknown, field: string): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new ServiceError(`${field} must be a number`, { status: 400 });
  return parsed;
}

export function normalizeSupplierInvoiceHeader(input: SupplierInvoiceHeaderInput) {
  const invoiceno = clean(input.invoiceno);
  const businesstype = clean(input.businesstype) || '01';
  if (!invoiceno) throw new ServiceError('invoiceno is required', { status: 400 });
  if (!SUPPLIER_TYPES.has(businesstype)) {
    throw new ServiceError('Supplier invoice business type must be 01 or 02', { status: 400 });
  }
  const invoicedate = clean(input.invoicedate);
  if (invoicedate && !/^\d{4}-\d{2}-\d{2}$/.test(invoicedate)) {
    throw new ServiceError('invoicedate must use YYYY-MM-DD', { status: 400 });
  }
  const currency = (clean(input.currency) || 'CNY').toUpperCase();
  return {
    invoiceno,
    invoicedate: invoicedate || null,
    supplier: clean(input.supplier) || null,
    description: clean(input.description) || null,
    comment: clean(input.comment) || null,
    bookingcode: clean(input.bookingcode) || null,
    businesstype,
    currency,
    totalnetamount: optionalNumber(input.totalnetamount, 'totalnetamount'),
    taxamount: optionalNumber(input.taxamount, 'taxamount'),
    grossamount: optionalNumber(input.grossamount, 'grossamount'),
  };
}

export async function insertSupplierInvoiceLines(
  client: pg.PoolClient,
  invoiceNo: string,
  lines: ReturnType<typeof normalizeRecognizedInvoiceLines>,
) {
  await client.query(
    `INSERT INTO "${TABLES.invoiceLine}" (
       invoiceno, seqno, description, spec_model, unit_price, quantity,
       amount_excl_tax, tax_rate, amount_incl_tax
     )
     SELECT $1, seqno, description, spec_model, unit_price, quantity,
            amount_excl_tax, tax_rate, amount_incl_tax
       FROM jsonb_to_recordset($2::jsonb) AS item(
         seqno INTEGER, description TEXT, spec_model TEXT, unit_price NUMERIC,
         quantity NUMERIC, amount_excl_tax NUMERIC, tax_rate TEXT, amount_incl_tax NUMERIC
       )`,
    [invoiceNo, JSON.stringify(lines)],
  );
}

export async function createSupplierInvoiceWithLines(
  dependencies: SupplierInvoiceRecognitionDependencies,
  auth: RequestAuthContext,
  headerInput: SupplierInvoiceHeaderInput,
  lineItems: RecognizedInvoiceLineInput[],
): Promise<StoredHeader> {
  const header = normalizeSupplierInvoiceHeader(headerInput);
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    throw new ServiceError('At least one invoice line is required', { status: 400 });
  }
  const lines = normalizeRecognizedInvoiceLines(lineItems);
  if (lines.some((line) => !line.description)) {
    throw new ServiceError('Every invoice line requires a description', { status: 400 });
  }

  return dependencies.withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT invoiceno FROM "${TABLES.invoice}" WHERE invoiceno = $1 FOR UPDATE`,
      [header.invoiceno],
    );
    if (existing.rowCount) {
      throw new ServiceError(`Invoice ${header.invoiceno} already exists`, { status: 409 });
    }
    const result = await client.query<StoredHeader>(
      `INSERT INTO "${TABLES.invoice}" (
         invoiceno, userid, invoicedate, supplier, description, comment, bookingcode,
         businesstype, currency, originalcurrency, totalnetamount, taxamount,
         grossamount, originalamount, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11,$12,$12,'OPEN')
       RETURNING invoiceno, userid, businesstype`,
      [header.invoiceno, auth.userid, header.invoicedate, header.supplier,
       header.description, header.comment, header.bookingcode, header.businesstype,
       header.currency, header.totalnetamount, header.taxamount, header.grossamount],
    );
    await insertSupplierInvoiceLines(client, header.invoiceno, lines);
    return result.rows[0];
  });
}
