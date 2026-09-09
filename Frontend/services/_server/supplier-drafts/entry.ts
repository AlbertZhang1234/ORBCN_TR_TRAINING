import { withTransaction } from '../../../lib/db';
import { SupplierDraftRepository } from './repository';
import { SupplierDraftFiles } from './files';
import { SupplierDraftService } from './service';
import { SupplierSourceService } from './source';
import { createInvoiceRecognitionClient } from '../invoiceRecognitionClient';
import { processNextSupplierDraft, processSupplierDraftById, startSupplierDraftWorker } from './worker';
import { invoiceAttachmentRuntime } from '../invoice-attachments/entry';
import { systemConfigRuntime } from '../system-config/entry';
import { backendLogDirectory, createInvoiceLogger } from '../invoice-log';
import { ServiceError } from '../../_core/error';

function supplierDraftDependencies() {
  const repo = new SupplierDraftRepository(withTransaction);
  const attachmentRuntime = invoiceAttachmentRuntime();
  const files: SupplierDraftFiles = attachmentRuntime.files;
  const maxMb = Number(process.env.SUPPLIER_UPLOAD_MAX_MB || 20);
  const maxBytes = (Number.isFinite(maxMb) && maxMb > 0 ? maxMb : 20) * 1024 * 1024;
  return { repo, files, attachmentRuntime, maxBytes };
}

export function supplierDraftRuntime() {
  const { repo, files, attachmentRuntime, maxBytes } = supplierDraftDependencies();
  const recognize = createInvoiceRecognitionClient();
  return { repo, files, service: new SupplierDraftService(repo, files, maxBytes, attachmentRuntime.repo,
    (id) => processSupplierDraftById(repo, files, recognize, id)),
    source: new SupplierSourceService(repo, files, attachmentRuntime.service) };
}

export function registerSupplierDraftWorker() {
  const { repo, files } = supplierDraftDependencies();
  const recognize = createInvoiceRecognitionClient();
  const { repository } = systemConfigRuntime();
  const log = createInvoiceLogger(backendLogDirectory(process.cwd(), process.env.BACKEND_LOG_DIR));
  return startSupplierDraftWorker(
    () => processNextSupplierDraft(repo, files, recognize),
    (error) => {
      const missing = error instanceof ServiceError && error.code === 'SYSTEM_CONFIG_MISSING';
      const message = missing ? error.message : '供应商识别 Worker 无法访问数据库或文件存储，将继续重试';
      console.error(`[supplier-drafts] ${missing ? 'Worker stopped' : 'Worker error'}: ${message}`);
      void log('supplier_worker_error', { error_type: missing ? 'system_config_missing' : 'database_or_storage',
        error_code: missing ? error.code : undefined, fatal: missing, message });
    },
    async () => (await repository.read()).values.worker_concurrency,
  );
}
