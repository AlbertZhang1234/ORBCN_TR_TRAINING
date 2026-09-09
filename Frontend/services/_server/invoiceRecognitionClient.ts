import { query, withTransaction } from '../../lib/db';
import { unstable_cache } from 'next/cache';
import { systemConfigRuntime } from './system-config/entry';
import { RecognitionGate } from './recognition-gate';
import { backendLogDirectory, createInvoiceLogger } from './invoice-log';
import { createRecognitionService } from './recognition-service';

// Composition entry shared by interactive reimbursement parsing and durable supplier jobs.
export function createInvoiceRecognitionClient() {
  const { repository } = systemConfigRuntime();
  const gate = new RecognitionGate(withTransaction);
  const settings = unstable_cache(() => repository.read(), ['invoice-recognition-settings'], { revalidate: 5 });
  const rules = unstable_cache(
    () => query('SELECT * FROM otto_booking_rule WHERE is_active=true ORDER BY sort_order'),
    ['invoice-recognition-rules'], { revalidate: 5 },
  );
  return createRecognitionService({
    endpoint: process.env.INVOICE_PARSE_ENDPOINT ?? process.env.NEXT_PUBLIC_INVOICE_PARSE_ENDPOINT
      ?? 'http://127.0.0.1:8201/api/v1/invoice/classify',
    settings,
    rules,
    acquire: (wait, lease) => gate.acquire(wait, lease),
    log: createInvoiceLogger(backendLogDirectory(process.cwd(), process.env.BACKEND_LOG_DIR)),
    fetch,
  });
}
