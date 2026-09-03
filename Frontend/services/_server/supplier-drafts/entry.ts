import path from 'node:path';
import { withTransaction } from '../../../lib/db';
import { SupplierDraftRepository } from './repository';
import { SupplierDraftFiles } from './files';
import { SupplierDraftService } from './service';
import { SupplierSourceService } from './source';
import { createInvoiceRecognitionClient } from '../invoiceRecognitionClient';
import { processNextSupplierDraft, startSupplierDraftWorker } from './worker';

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
  return startSupplierDraftWorker(
    () => processNextSupplierDraft(repo, files, recognize),
    () => console.error('[supplier-drafts] Worker database/storage unavailable; will retry.'),
  );
}
