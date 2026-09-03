import type pg from 'pg';
import { createHash } from 'node:crypto';
import { supplierInvoiceContent, type SupplierInvoiceDetail } from '../../Invoice/supplier-edit-model';
import { insertSupplierInvoiceLines } from '../supplierInvoiceRecognition';
import { normalizeRecognizedInvoiceLines } from '../invoiceLines';
import { lineForSave } from '../../Invoice/supplier-draft-model';

export async function readSupplierInvoice(db: pg.PoolClient, invoiceNo: string, lock: 'read' | 'write') {
  const row = (await db.query(
    `SELECT * FROM otto_invoices WHERE invoiceno=$1 FOR ${lock === 'write' ? 'UPDATE' : 'SHARE'}`, [invoiceNo],
  )).rows[0];
  if (!row) return null;
  const lines = (await db.query('SELECT * FROM otto_invoice_lines WHERE invoiceno=$1 ORDER BY seqno FOR UPDATE', [invoiceNo])).rows;
  const content = supplierInvoiceContent(row, lines);
  const revision = createHash('sha256').update(JSON.stringify({ row, lines })).digest('hex');
  return { ...content, revision };
}

// Use a new parent temporarily when correcting the primary key. Move every known
// foreign key before deleting the old parent, so existing non-cascading schemas work.
async function renameSupplierInvoice(db: pg.PoolClient, oldNo: string, newNo: string) {
  await db.query(`INSERT INTO otto_invoices SELECT (jsonb_populate_record(NULL::otto_invoices,
    to_jsonb(i) || jsonb_build_object('invoiceno', $2::text))).* FROM otto_invoices i WHERE invoiceno=$1`, [oldNo, newNo]);
  await db.query('UPDATE otto_invoice_lines SET invoiceno=$2 WHERE invoiceno=$1', [oldNo, newNo]);
  await db.query('UPDATE otto_tr_t SET invoiceno=$2 WHERE invoiceno=$1', [oldNo, newNo]);
  await db.query('UPDATE otto_supplier_invoice_drafts SET saved_invoice_no=$2 WHERE saved_invoice_no=$1', [oldNo, newNo]);
  await db.query('DELETE FROM otto_invoices WHERE invoiceno=$1', [oldNo]);
}

export async function writeSupplierInvoice(db: pg.PoolClient, oldNo: string, detail: SupplierInvoiceDetail) {
  const h = detail.header;
  if (oldNo !== h.invoiceno) await renameSupplierInvoice(db, oldNo, h.invoiceno);
  await db.query(`UPDATE otto_invoices SET userid=$2, travelid=$3, invoicedate=$4, supplier=$5,
    description=$6, comment=$7, bookingcode=$8, businesstype=$9, currency=$10,
    totalnetamount=$11, taxamount=$12, grossamount=$13, originalamount=$14, originalcurrency=$15
    WHERE invoiceno=$1`, [h.invoiceno, h.userid, h.travelid || null, h.invoicedate || null, h.supplier || null,
    h.description || null, h.comment || null, h.bookingcode || null, h.businesstype, h.currency,
    h.totalnetamount, h.taxamount, h.grossamount, h.originalamount, h.originalcurrency || null]);
  await db.query('DELETE FROM otto_invoice_lines WHERE invoiceno=$1', [h.invoiceno]);
  await insertSupplierInvoiceLines(db, h.invoiceno, normalizeRecognizedInvoiceLines(detail.lines.map(lineForSave)));
  await db.query(`UPDATE otto_supplier_invoice_drafts SET header=$2::jsonb, lines=$3::jsonb,
    version=version+1, updated_at=now() WHERE saved_invoice_no=$1 AND status='saved'`,
  [h.invoiceno, JSON.stringify(h), JSON.stringify(detail.lines)]);
  return (await readSupplierInvoice(db, h.invoiceno, 'write'))!;
}
