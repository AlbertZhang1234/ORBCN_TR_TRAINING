import path from 'node:path';
import { withTransaction } from '../../../lib/db';
import { SupplierDraftRepository } from './repository';
import { SupplierDraftFiles } from './files';
import { SupplierDraftService } from './service';
import { SupplierSourceService } from './source';
import { createInvoiceRecognitionClient } from '../invoiceRecognitionClient';
import { processNextSupplierDraft, startSupplierDraftWorker } from './worker';
import { systemConfigRuntime } from '../system-config/entry';
import { backendLogDirectory, createInvoiceLogger } from '../invoice-log';

export function supplierDraftRuntime() {
  const legacyRoot = path.resolve(process.cwd(), 'data');
  const root = path.resolve(process.env.SUPPLIER_INVOICE_STORAGE_DIR || path.join(legacyRoot, 'supplier-originals'));
  const repo = new SupplierDraftRepository(withTransaction);
  const files = new SupplierDraftFiles(root, legacyRoot);
  const maxMb = Number(process.env.SUPPLIER_UPLOAD_MAX_MB || 20);
  const maxBytes = (Number.isFinite(maxMb) && maxMb > 0 ? maxMb : 20) * 1024 * 1024;
  return { repo, files, service: new SupplierDraftService(repo, files, maxBytes), source: new SupplierSourceService(repo, files) };
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
