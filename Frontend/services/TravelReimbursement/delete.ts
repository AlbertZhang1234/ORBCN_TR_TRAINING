import { deleteRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';
import { ensureInvoiceMutable, getInvoiceByNo, setInvoiceStatus } from '../Invoice/_shared';
import {
  assertHeaderMutable,
  deleteLinesByHeader,
  getHeaderFilter,
  getLineRowsByHeader,
  getReimbursementHeader,
  insertLineWithFallback,
  ReimbursementFilter,
} from './_shared';

export async function deleteTravelReimbursement(
  filter: ReimbursementFilter,
): Promise<{ deleted: boolean; invoiceNos: string[] }> {
  const header = await getReimbursementHeader(filter);
  if (!header) {
    return { deleted: false, invoiceNos: [] };
  }

  assertHeaderMutable(header);

  const lineRows = await getLineRowsByHeader(header);
  const invoiceNos = lineRows.map((line) => line.invoiceno);
  for (const invoiceNo of invoiceNos) {
    const invoice = await getInvoiceByNo(invoiceNo);
    if (!invoice) {
      continue;
    }

    ensureInvoiceMutable(invoice);
  }

  await deleteLinesByHeader(header);

  try {
    for (const invoiceNo of invoiceNos) {
      const invoice = await getInvoiceByNo(invoiceNo);
      if (!invoice) {
        continue;
      }
      await setInvoiceStatus(invoice, 'open');
    }
  } catch (err) {
    for (const line of lineRows) {
      await insertLineWithFallback(
        header,
        line.invoiceno,
        line.tr_amount,
        line.trchargeable,
        line.txchargeable,
        line.seqno,
      ).catch(() => undefined);
    }
    throw err;
  }

  try {
    const deleted = await deleteRows(TABLES.reimbursementHeader, getHeaderFilter(filter));
    return { deleted: deleted.length > 0, invoiceNos };
  } catch (err) {
    for (const line of lineRows) {
      await insertLineWithFallback(
        header,
        line.invoiceno,
        line.tr_amount,
        line.trchargeable,
        line.txchargeable,
        line.seqno,
      ).catch(() => undefined);
    }
    for (const invoiceNo of invoiceNos) {
      const invoice = await getInvoiceByNo(invoiceNo);
      if (invoice) {
        await setInvoiceStatus(invoice, 'submitted').catch(() => undefined);
      }
    }
    throw err;
  }
}
