import { query } from '../../lib/db';
import { ServiceError } from '../_core/error';
import type { InvoiceParseResult } from '../Invoice/parse';

// Composition entry shared by interactive reimbursement parsing and durable supplier jobs.
export function createInvoiceRecognitionClient() {
  const endpoint = process.env.INVOICE_PARSE_ENDPOINT ?? process.env.NEXT_PUBLIC_INVOICE_PARSE_ENDPOINT
    ?? 'http://127.0.0.1:8201/api/v1/invoice/classify';
  return async (file: File): Promise<InvoiceParseResult> => {
    const rules = await query('SELECT * FROM otto_booking_rule WHERE is_active=true ORDER BY sort_order');
    if (!rules.length) throw new ServiceError('No active booking rules configured', { status: 503 });
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('booking_rules', JSON.stringify(rules));
    const response = await fetch(endpoint, { method: 'POST', body: form, signal: AbortSignal.timeout(240_000) });
    if (!response.ok) throw new ServiceError(`Invoice recognition failed (${response.status})`, { status: 502 });
    return response.json();
  };
}
