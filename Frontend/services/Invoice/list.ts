import { selectRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export interface InvoiceListRow extends Record<string, unknown> {
  invoiceno: string;
  userid?: string;
  travelid?: string;
  invoicedate?: string;
  totalnetamount?: number;
  totalnetamour?: number;
  taxamount?: number;
  grossamount?: number;
  bookingcode?: string;
  businesstype?: string;
  currency?: string;
  originalamount?: number;
  originalcurrency?: string;
  status?: string;
  comment?: string;
  description?: string;
  supplier?: string;
}

function parseAmount(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/[，,]/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function isGeneratedReceiptInvoiceNo(invoiceNo: unknown): boolean {
  return /(?:^|-)\d{8}-\d{3}$/.test(String(invoiceNo ?? '').trim());
}

function normalizeInvoiceRow(row: InvoiceListRow): InvoiceListRow {
  if (
    parseAmount(row.taxamount) === undefined &&
    isGeneratedReceiptInvoiceNo(row.invoiceno)
  ) {
    return { ...row, taxamount: 0 };
  }
  return row;
}

export async function listInvoices(): Promise<InvoiceListRow[]> {
  const rows = await selectRows<InvoiceListRow>(TABLES.invoice, {
    orderBy: { column: 'invoiceno', ascending: true },
  });
  return rows.map(normalizeInvoiceRow);
}
