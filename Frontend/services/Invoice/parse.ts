import { ServiceError } from '../_core/error';
import { getClientSessionId } from '../_core/session';
import type { RecognizedInvoiceLine } from './lines';

export interface InvoiceParseResult extends Record<string, unknown> {
  file?: string;
  status?: number;
  category_code?: string;
  confidence?: number;
  remark?: string;
  invoice_number?: string;
  issue_date?: string;
  buyer_name?: string;
  buyer_tax_no?: string;
  seller_name?: string;
  seller_tax_no?: string;
  currency?: string;
  amount_excl_tax?: number | null;
  tax_amount?: number | null;
  amount_incl_tax?: number | null;
  line_items_count?: number;
  line_items?: RecognizedInvoiceLine[];
  engine?: string;
  fallback_used?: boolean;
  reason?: string;
}

function getParseEndpoint(): string {
  return '/api/invoice/parse';
}

export async function parseInvoice(
  file: Blob,
  fileName = 'invoice.pdf',
): Promise<InvoiceParseResult> {
  const endpoint = getParseEndpoint();
  const formData = new FormData();
  formData.append('file', file, fileName);

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
    throw new ServiceError(`parseInvoice failed (${response.status}): ${detail}`);
  }

  return (await response.json()) as InvoiceParseResult;
}
