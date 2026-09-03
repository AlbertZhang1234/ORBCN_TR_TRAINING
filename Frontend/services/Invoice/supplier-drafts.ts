import { ServiceError } from '../_core/error';
import { getClientSessionId } from '../_core/session';
import type { SupplierInvoiceDraft, SupplierBusinessType } from './supplier-draft-model';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store', headers: {
    ...init?.headers, 'x-session-id': getClientSessionId(),
  } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ServiceError(body.message || `Request failed (${response.status})`, { status: response.status });
  }
  return response.json();
}
export const supplierDraftApi = {
  list: () => request<SupplierInvoiceDraft[]>('/api/supplier-invoices/drafts'),
  upload: (file: File, businessType: SupplierBusinessType) => {
    const body = new FormData();
    body.append('file', file); body.append('businesstype', businessType);
    return request<SupplierInvoiceDraft>('/api/supplier-invoices/drafts', { method: 'POST', body });
  },
  patch: (row: SupplierInvoiceDraft) => request<SupplierInvoiceDraft>(`/api/supplier-invoices/drafts/${row.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: row.version, header: row.header, lines: row.lines }),
  }),
  action: (row: SupplierInvoiceDraft, action: 'confirm' | 'save' | 'retry') => request<SupplierInvoiceDraft>(`/api/supplier-invoices/drafts/${row.id}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, version: row.version }),
  }),
};
