import { supplierDraftRuntime } from '../supplier-drafts/entry';
import { SupplierInvoiceEditService } from './service';

export function supplierInvoiceEditService() {
  const { repo, files } = supplierDraftRuntime();
  return new SupplierInvoiceEditService(repo.transaction, files);
}
