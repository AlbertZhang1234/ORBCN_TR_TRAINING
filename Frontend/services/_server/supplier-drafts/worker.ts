import { randomUUID } from 'node:crypto';
import { recognizedContent } from '../../Invoice/supplier-draft-model';
import type { InvoiceParseResult } from '../../Invoice/parse';
import type { SupplierDraftRepository } from './repository';
import type { SupplierDraftFiles } from './files';
import { ServiceError } from '../../_core/error';
import { defaultRecognitionSettings } from '../../SystemConfig/model';

export async function processNextSupplierDraft(
  repo: SupplierDraftRepository, files: SupplierDraftFiles, recognize: (file: File) => Promise<InvoiceParseResult>,
): Promise<boolean> {
  return processSupplierDraft(repo, files, recognize);
}

export async function processSupplierDraftById(
  repo: SupplierDraftRepository, files: SupplierDraftFiles, recognize: (file: File) => Promise<InvoiceParseResult>, id: string,
): Promise<boolean> {
  return processSupplierDraft(repo, files, recognize, id);
}

async function processSupplierDraft(
  repo: SupplierDraftRepository, files: SupplierDraftFiles, recognize: (file: File) => Promise<InvoiceParseResult>, id?: string,
): Promise<boolean> {
  const token = randomUUID();
  const row = await repo.claim(token, id);
  if (!row) return false;
  try {
    const bytes = await files.read(row.storage_kind, row.storage_key);
    const result = await recognize(new File([new Uint8Array(bytes)], row.filename, { type: row.content_type }));
    await repo.finish(row.id, token, recognizedContent(row.header, result), result, null);
  } catch (error) {
    if (error instanceof ServiceError && error.code === 'RECOGNITION_BUSY') {
      await repo.requeue(row.id, token);
      return false;
    }
    await repo.finish(row.id, token, null, null, error instanceof Error ? error.message : '识别失败，请重试');
  }
  return true;
}

export function startSupplierDraftWorker(run: () => Promise<boolean>, report: (error: unknown) => void,
  concurrency: () => Promise<number> = async () => defaultRecognitionSettings.worker_concurrency, pollMs = 1500) {
  let active = 0;
  let stopped = false;
  let checking = false;
  let timer: ReturnType<typeof setInterval>;
  const stop = () => { stopped = true; if (timer) clearInterval(timer); };
  const tick = async () => {
    if (stopped || checking) return;
    checking = true;
    try {
      const limit = await concurrency();
      while (!stopped && active < limit) {
        active += 1;
        void run().catch((error) => { report(error); return false; }).then((worked) => {
          active -= 1;
          if (worked && !stopped) void tick();
        });
      }
    } catch (error) {
      report(error);
      if (error instanceof ServiceError && error.code === 'SYSTEM_CONFIG_MISSING') stop();
    }
    finally { checking = false; }
  };
  timer = setInterval(() => void tick(), pollMs);
  timer.unref();
  void tick();
  return stop;
}
