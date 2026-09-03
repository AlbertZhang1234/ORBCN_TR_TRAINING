import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export type InvoiceLog = (event: string, fields: Record<string, string | number | boolean | undefined>) => Promise<void>;
export function backendLogDirectory(cwd: string, override?: string) {
  return path.resolve(override || path.join(cwd, '..', 'Backend', 'log'));
}
export function createInvoiceLogger(directory: string): InvoiceLog {
  return async (event, fields) => {
    try {
      await mkdir(directory, { recursive: true });
      const date = new Date().toISOString();
      await appendFile(path.join(directory, `invoice-client-${date.slice(0, 10)}-${process.pid}.jsonl`),
        `${JSON.stringify({ timestamp: date, event, ...fields })}\n`, 'utf8');
    } catch { console.error('[invoice-log] Unable to write recognition log'); }
  };
}
