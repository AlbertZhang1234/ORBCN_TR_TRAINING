import { query } from '../../lib/db';
import type {
  SuperMiroReimbursementPostingDependencies,
  SuperMiroReimbursementReference,
  SuperMiroReimbursementSource,
  SuperMiroType03LineSource,
} from '../Sap/superMiro';
import {
  createSuperMiroEInvoiceWriter,
  SAP_POSTED_BOOKING_STATUS,
  selectLocalizedBookingDescription,
} from '../Sap/superMiro';
import { ServiceError } from '../_core/error';

interface SuperMiroPostingRow extends Record<string, unknown> {
  reimbursement_id?: number | string;
  reimbursement_no?: string;
  approval_status?: string;
  sap_supplier_id?: string;
  seqno?: number | string;
  invoiceno?: string;
  businesstype?: string;
  invoicedate?: string;
  supplier?: string;
  description?: string;
  currency?: string;
  tr_amount?: string | number;
  grossamount?: string | number;
  taxamount?: string | number;
  comment?: string;
  bookingcode?: string;
  booking_name_zh?: string;
  booking_name_en?: string;
  language?: 'zh' | 'en';
  accountingsubject?: string;
  costcenter?: string;
}

function buildReferenceFilter(reference: SuperMiroReimbursementReference): {
  sql: string;
  value: number | string;
} {
  const idText = String(reference.id ?? '').trim();
  if (idText) {
    const id = Number(idText);
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new ServiceError('Reimbursement id must be a positive integer', { status: 400 });
    }
    return { sql: 'h.id = $1', value: id };
  }
  const trno = String(reference.trno ?? '').trim();
  if (trno) {
    return { sql: 'h.trno = $1', value: trno };
  }
  throw new ServiceError('Reimbursement reference requires id or trno', { status: 400 });
}

function mapLine(row: SuperMiroPostingRow): SuperMiroType03LineSource | null {
  const invoiceNo = String(row.invoiceno ?? '').trim();
  if (!invoiceNo) {
    return null;
  }
  return {
    seqno: Number(row.seqno),
    invoiceNo,
    businessType: String(row.businesstype ?? '').trim(),
    issueDate: String(row.invoicedate ?? ''),
    sellerName: String(row.supplier ?? ''),
    description: String(row.description ?? ''),
    currency: String(row.currency ?? ''),
    amount: row.tr_amount,
    grossAmount: row.grossamount,
    taxAmount: row.taxamount,
    note: String(row.comment ?? ''),
    bookingCode: String(row.bookingcode ?? ''),
    bookingDescription: selectLocalizedBookingDescription(
      row.language ?? 'zh',
      row.booking_name_zh,
      row.booking_name_en,
    ),
    hkont: String(row.accountingsubject ?? ''),
    kostl: String(row.costcenter ?? ''),
  };
}

async function loadReimbursement(
  reference: SuperMiroReimbursementReference,
): Promise<SuperMiroReimbursementSource> {
  const filter = buildReferenceFilter(reference);
  const rows = await query<SuperMiroPostingRow>(
    `SELECT
       h.id AS reimbursement_id,
       h.trno AS reimbursement_no,
       h.approvalstatus AS approval_status,
       u.sap_supplier_id,
       t.seqno,
       t.invoiceno,
       t.tr_amount,
       i.businesstype,
       to_char(i.invoicedate, 'YYYY-MM-DD') AS invoicedate,
       i.supplier,
       i.description,
       i.currency,
       i.grossamount,
       i.taxamount,
       i.comment,
       i.bookingcode,
       rule.name_zh AS booking_name_zh,
       rule.name_en AS booking_name_en,
       rule.accountingsubject,
       rule.costcenter
     FROM "otto_tr_h" h
     LEFT JOIN "otto_user" u ON u.userid = h.userid
     LEFT JOIN "otto_tr_t" t ON t.id = h.id
     LEFT JOIN "otto_invoices" i ON i.invoiceno = t.invoiceno
     LEFT JOIN "otto_booking_rule" rule ON rule.code = i.bookingcode
     WHERE ${filter.sql}
     ORDER BY t.seqno ASC`,
    [filter.value],
  );

  const header = rows[0];
  if (!header) {
    throw new ServiceError('Reimbursement not found', { status: 404 });
  }
  return {
    id: header.reimbursement_id ?? reference.id ?? '',
    trno: String(header.reimbursement_no ?? ''),
    approvalStatus: String(header.approval_status ?? ''),
    sapSupplierId: String(header.sap_supplier_id ?? '').trim(),
    lines: rows
      .map((row) => mapLine({ ...row, language: reference.language }))
      .filter((line): line is SuperMiroType03LineSource => line !== null),
  };
}

async function markReimbursementSapPosted(source: SuperMiroReimbursementSource): Promise<void> {
  const id = Number(source.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ServiceError('Reimbursement id must be a positive integer');
  }

  const rows = await query<{ id: number }>(
    'UPDATE "otto_tr_h" SET bookingstatus = $2 WHERE id = $1 RETURNING id',
    [id, SAP_POSTED_BOOKING_STATUS],
  );
  if (!rows[0]) {
    throw new ServiceError(`Reimbursement ${source.trno ?? source.id} status update failed`);
  }
}

export function createSuperMiroReimbursementDependencies(): SuperMiroReimbursementPostingDependencies {
  const writer = createSuperMiroEInvoiceWriter();
  return {
    loadReimbursement,
    postPayload: writer,
    markReimbursementSapPosted,
  };
}
