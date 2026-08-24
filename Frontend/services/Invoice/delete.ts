import { ServiceError } from '../_core/error';
import { deleteRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';
import { ensureInvoiceContentMutable, getInvoiceByNo } from './_shared';

export async function deleteInvoice(invoiceNo: string): Promise<boolean> {
  if (!invoiceNo?.trim()) {
    throw new ServiceError('invoiceNo is required');
  }

  const invoice = await getInvoiceByNo(invoiceNo);
  if (!invoice) {
    return false;
  }

  ensureInvoiceContentMutable(invoice);

  const deleted = await deleteRows(TABLES.invoice, { invoiceno: invoiceNo });
  return deleted.length > 0;
}
