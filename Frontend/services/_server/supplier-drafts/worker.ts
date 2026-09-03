import { randomUUID } from 'node:crypto';
import { recognizedContent } from '../../Invoice/supplier-draft-model';
import type { InvoiceParseResult } from '../../Invoice/parse';
import type { SupplierDraftRepository } from './repository';
import type { SupplierDraftFiles } from './files';

export async function processNextSupplierDraft(
  repo: SupplierDraftRepository, files: SupplierDraftFiles, recognize: (file: File) => Promise<InvoiceParseResult>,
): Promise<boolean> {
  const token = randomUUID();
  const row = await repo.claim(token);
  if (!row) return false;
  try {
    const bytes = await files.read(row.storage_key);
    const result = await recognize(new File([new Uint8Array(bytes)], row.filename, { type: row.content_type }));
    await repo.finish(row.id, token, recognizedContent(row.header, result), result, null);
  } catch (error) {
    await repo.finish(row.id, token, null, null, error instanceof Error ? error.message : '识别失败，请重试');
  }
  return true;
}

export function startSupplierDraftWorker(run: () => Promise<boolean>, report: (error: unknown) => void) {
  let active = 0;
  let stopped = false;
  const tick = () => {
    if (stopped || active >= 2) return;
    active += 1;
    void run().catch(report).finally(() => { active -= 1; });
  };
  const timer = setInterval(tick, 1500);
  timer.unref();
  tick();
  return () => { stopped = true; clearInterval(timer); };
}
