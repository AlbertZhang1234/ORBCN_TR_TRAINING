import { ServiceError } from '../_core/error';
import {
  buildStatusPatch,
  ensureRecordMutable,
  isSubmittedStatus,
  isBookedStatus,
  normalizeWorkflowStatus,
  readFirstExisting,
  STATUS_CANDIDATES,
} from '../_core/locks';
import { selectOne, updateRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export interface InvoiceRecord extends Record<string, unknown> {
  invoiceno: string;
  userid?: string;
  travelid?: string;
  invoicedate?: string;
  totalnetamount?: number;
  taxamount?: number;
  grossamount?: number;
  bookingcode?: string;
  currency?: string;
  originalamount?: number;
  originalcurrency?: string;
  status?: string;
  comment?: string;
  description?: string;
  supplier?: string;
}

export async function getInvoiceByNo(invoiceNo: string): Promise<InvoiceRecord | null> {
  return selectOne<InvoiceRecord>(TABLES.invoice, { invoiceno: invoiceNo });
}

export function ensureInvoiceMutable(invoice: InvoiceRecord): void {
  ensureRecordMutable(invoice, `Invoice ${invoice.invoiceno}`);
}

export function ensureInvoiceContentMutable(invoice: InvoiceRecord): void {
  const value = readFirstExisting(invoice, STATUS_CANDIDATES);
  if (isSubmittedStatus(value) || isBookedStatus(value)) {
    throw new ServiceError(
      `Invoice ${invoice.invoiceno} is already submitted/booked and cannot be changed`,
    );
  }
}

export function isInvoiceBooked(invoice: InvoiceRecord): boolean {
  const value = readFirstExisting(invoice, STATUS_CANDIDATES);
  return isBookedStatus(value);
}

export function isInvoiceSubmitted(invoice: InvoiceRecord): boolean {
  const value = readFirstExisting(invoice, STATUS_CANDIDATES);
  return isSubmittedStatus(value);
}

export function readInvoiceWorkflowStatus(invoice: InvoiceRecord): string {
  const value = readFirstExisting(invoice, STATUS_CANDIDATES);
  return normalizeWorkflowStatus(value);
}

export async function setInvoiceStatus(
  invoice: InvoiceRecord,
  nextStatus: 'open' | 'submitted' | 'booked',
  actor?: string,
  atIso?: string,
): Promise<InvoiceRecord> {
  const patch = buildStatusPatch(invoice, nextStatus, actor, atIso);
  if (Object.keys(patch).length === 0) {
    throw new ServiceError(
      `Invoice ${invoice.invoiceno} has no supported status field (expected one of: ${STATUS_CANDIDATES.join(', ')})`,
    );
  }

  const rows = await updateRows<InvoiceRecord>(
    TABLES.invoice,
    { invoiceno: invoice.invoiceno },
    patch,
  );

  if (!rows[0]) {
    throw new ServiceError(`Invoice ${invoice.invoiceno} status update failed`);
  }

  return rows[0];
}
