import { supplierDraftRuntime } from '../supplier-drafts/entry';
import { SupplierInvoiceEditService } from './service';
import { invoiceAttachmentRuntime } from '../invoice-attachments/entry';

export function supplierInvoiceEditService() {
  const { repo, files } = supplierDraftRuntime();
  return new SupplierInvoiceEditService(repo.transaction, files, invoiceAttachmentRuntime().repo);
}
