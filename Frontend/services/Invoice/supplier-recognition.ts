import { ServiceError } from '../_core/error';
import { getClientSessionId } from '../_core/session';
import type { RecognizedInvoiceLine } from './lines';

export interface SupplierInvoiceSaveHeader {
  invoiceno: string;
  invoicedate?: string;
  supplier?: string;
  description?: string;
  comment?: string;
  bookingcode?: string;
  businesstype: '01' | '02';
  currency?: string;
  totalnetamount?: number | null;
  taxamount?: number | null;
  grossamount?: number | null;
}

export async function saveSupplierRecognizedInvoice(
  header: SupplierInvoiceSaveHeader,
  lineItems: RecognizedInvoiceLine[],
): Promise<void> {
  const response = await fetch('/api/supplier-invoices/recognition', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session-id': getClientSessionId() },
    body: JSON.stringify({ header, lineItems }),
  });
  if (!response.ok) {
    let message = `Supplier invoice save failed (${response.status})`;
    try {
      const payload = await response.json();
      if (typeof payload?.message === 'string') message = payload.message;
    } catch {
      // Keep status fallback.
    }
    throw new ServiceError(message, { status: response.status });
  }
}
