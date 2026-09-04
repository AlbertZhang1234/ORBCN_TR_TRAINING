import { withTransaction } from '../../../lib/db';
import { SupplierDraftRepository } from './repository';
import { SupplierDraftFiles } from './files';
import { SupplierDraftService } from './service';
import { SupplierSourceService } from './source';
import { createInvoiceRecognitionClient } from '../invoiceRecognitionClient';
import { processNextSupplierDraft, startSupplierDraftWorker } from './worker';
import { invoiceAttachmentRuntime } from '../invoice-attachments/entry';
import { systemConfigRuntime } from '../system-config/entry';
import { backendLogDirectory, createInvoiceLogger } from '../invoice-log';

export function supplierDraftRuntime() {
  const repo = new SupplierDraftRepository(withTransaction);
  const attachmentRuntime = invoiceAttachmentRuntime();
  const files: SupplierDraftFiles = attachmentRuntime.files;
  const maxMb = Number(process.env.SUPPLIER_UPLOAD_MAX_MB || 20);
  const maxBytes = (Number.isFinite(maxMb) && maxMb > 0 ? maxMb : 20) * 1024 * 1024;
  return { repo, files, service: new SupplierDraftService(repo, files, maxBytes, attachmentRuntime.repo),
    source: new SupplierSourceService(repo, files, attachmentRuntime.service) };
}

export function registerSupplierDraftWorker() {
  const { repo, files } = supplierDraftRuntime();
  const recognize = createInvoiceRecognitionClient();
  const { repository } = systemConfigRuntime();
  const log = createInvoiceLogger(backendLogDirectory(process.cwd(), process.env.BACKEND_LOG_DIR));
  return startSupplierDraftWorker(
    () => processNextSupplierDraft(repo, files, recognize),
    () => { void log('supplier_worker_error', { error_type: 'database_or_storage' }); },
    async () => (await repository.read()).values.worker_concurrency,
  );
}
