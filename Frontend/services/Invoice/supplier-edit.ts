import { ServiceError } from '../_core/error';
import { getClientSessionId } from '../_core/session';
import type { SupplierInvoiceDetail } from './supplier-edit-model';

async function request(invoiceNo: string, init?: RequestInit): Promise<SupplierInvoiceDetail> {
  const response = await fetch(`/api/supplier-invoices/detail?invoiceNo=${encodeURIComponent(invoiceNo)}`, {
    ...init, cache: 'no-store', headers: { 'Content-Type': 'application/json', 'x-session-id': getClientSessionId() },
  });
  const body = await response.json();
  if (!response.ok) throw new ServiceError(body.message || `Request failed (${response.status})`, { status: response.status });
  return body;
}
export const supplierInvoiceEditApi = {
  load: (invoiceNo: string, signal?: AbortSignal) => request(invoiceNo, { signal }),
  save: (invoiceNo: string, detail: SupplierInvoiceDetail) => request(invoiceNo, { method: 'PUT', body: JSON.stringify(detail) }),
};
