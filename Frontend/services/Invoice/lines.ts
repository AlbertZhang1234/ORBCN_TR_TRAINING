import { ServiceError } from '../_core/error';
import { getClientSessionId } from '../_core/session';

export interface RecognizedInvoiceLine {
  line_no?: number;
  description?: string;
  spec_model?: string;
  unit_price?: number | null;
  quantity?: number | null;
  amount_excl_tax?: number | null;
  tax_rate?: string;
  amount_incl_tax?: number | null;
}

export async function saveRecognizedInvoiceLines(
  invoiceNo: string,
  lineItems: RecognizedInvoiceLine[],
): Promise<void> {
  const response = await fetch('/api/invoice/lines', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': getClientSessionId(),
    },
    body: JSON.stringify({ invoiceno: invoiceNo, lineItems }),
  });

  if (!response.ok) {
    let message = `Invoice line save failed (${response.status})`;
    try {
      const payload = await response.json();
      if (typeof payload?.message === 'string') message = payload.message;
    } catch {
      // Keep the status-based fallback message.
    }
    throw new ServiceError(message, { status: response.status });
  }
}
