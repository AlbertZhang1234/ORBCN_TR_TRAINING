import path from 'node:path';
import { withTransaction } from '../../../lib/db';
import { InvoiceAttachmentFiles } from './files';
import { InvoiceAttachmentRepository } from './repository';
import { InvoiceAttachmentService } from './service';

export function invoiceAttachmentRuntime() {
  const dataRoot = path.resolve(process.cwd(), 'data');
  const managedRoot = path.resolve(process.env.INVOICE_ATTACHMENT_STORAGE_DIR || path.join(dataRoot, 'invoice-attachments'));
  const legacySupplierRoot = path.resolve(process.env.SUPPLIER_INVOICE_STORAGE_DIR || path.join(dataRoot, 'supplier-originals'));
  const files = new InvoiceAttachmentFiles(managedRoot, dataRoot, legacySupplierRoot);
  const repo = new InvoiceAttachmentRepository(withTransaction);
  const configured = Number(process.env.INVOICE_ATTACHMENT_MAX_MB || process.env.SUPPLIER_UPLOAD_MAX_MB || 20);
  const maxBytes = (Number.isFinite(configured) && configured > 0 ? configured : 20) * 1024 * 1024;
  return { files, repo, service: new InvoiceAttachmentService(repo, files, maxBytes) };
}
