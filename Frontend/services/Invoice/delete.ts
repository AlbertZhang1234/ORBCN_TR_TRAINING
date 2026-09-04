import { ServiceError } from '../_core/error';
import { getClientSessionId } from '../_core/session';

export async function deleteInvoice(invoiceNo: string): Promise<boolean> {
  if (!invoiceNo?.trim()) {
    throw new ServiceError('invoiceNo is required');
  }

  const response = await fetch(`/api/invoice/source?invoiceNo=${encodeURIComponent(invoiceNo.trim())}`, {
    method: 'DELETE', headers: { 'x-session-id': getClientSessionId() },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ServiceError(typeof body?.message === 'string' ? body.message : `Delete invoice failed (${response.status})`);
  }
  return Boolean((await response.json()).deleted);
}
