import { ServiceError } from '../_core/error';
import { getClientSessionId } from '../_core/session';

function getSourceEndpoint(): string {
  return '/api/invoice/source';
}

export async function saveInvoiceSourceFile(file: File, invoiceNo: string): Promise<void> {
  const normalizedInvoiceNo = invoiceNo.trim();
  if (!normalizedInvoiceNo) {
    throw new ServiceError('invoiceNo is required');
  }
  const endpoint = getSourceEndpoint();
  const formData = new FormData();
  formData.append('file', file, file.name || 'invoice');
  formData.append('invoiceNo', normalizedInvoiceNo);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'x-session-id': getClientSessionId(),
    },
    body: formData,
  });

  if (!response.ok) {
    let detail = '';
    try {
      detail = JSON.stringify(await response.json());
    } catch {
      detail = await response.text();
    }
    throw new ServiceError(`saveInvoiceSourceFile failed (${response.status}): ${detail}`);
  }
}
