import { selectRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';
import { listInvoices } from '../Invoice/list';
import {
  getLineRowsByHeader,
  getReimbursementHeader,
  normalizeLineAmount,
  type ReimbursementLine,
  type ReimbursementFilter,
} from './_shared';

export interface ReimbursementListRow extends Record<string, unknown> {
  id?: number;
  trno?: string;
  userid?: string;
  projectid?: string;
  project_description?: string;
  created_at?: string;
  createdat?: string;
  bookingstatus?: string;
  booking_status?: string;
  approvalstatus?: string;
  approval_status?: string;
  approver?: string;
  approvalby?: string;
  approvedby?: string;
  approver_name?: string;
  total_amount?: number;
  invoice_count?: number;
  originalamount?: number;
  originalcurrency?: string;
}

export async function listReimbursements(): Promise<ReimbursementListRow[]> {
  try {
    return await selectRows<ReimbursementListRow>(TABLES.reimbursementHeader, {
      orderBy: { column: 'id', ascending: false },
    });
  } catch {
    return selectRows<ReimbursementListRow>(TABLES.reimbursementHeader, {
      orderBy: { column: 'trno', ascending: false },
    });
  }
}

export async function listReimbursementInvoiceNos(
  filter: ReimbursementFilter,
): Promise<string[]> {
  const lines = await listReimbursementLines(filter);
  return lines.map((line) => line.invoiceno);
}

export async function listReimbursementLines(
  filter: ReimbursementFilter,
): Promise<ReimbursementLine[]> {
  const header = await getReimbursementHeader(filter);
  if (!header) {
    return [];
  }
  return getLineRowsByHeader(header);
}

export interface ReimbursementInvoiceDetailRow extends Record<string, unknown> {
  invoiceno: string;
  seqno?: number;
  supplier?: string;
  description?: string;
  comment?: string;
  userid?: string;
  travelid?: string;
  invoicedate?: string;
  bookingcode?: string;
  currency?: string;
  status?: string;
  totalnetamount?: number;
  taxamount?: number;
  grossamount?: number;
  originalamount?: number;
  originalcurrency?: string;
  tr_amount?: string;
  trchargeable?: boolean;
  txchargeable?: boolean;
}

export async function listReimbursementInvoiceDetails(
  filter: ReimbursementFilter,
): Promise<ReimbursementInvoiceDetailRow[]> {
  const [lines, invoices] = await Promise.all([listReimbursementLines(filter), listInvoices()]);

  const invoiceMap = new Map(
    invoices
      .map((invoice) => [String(invoice.invoiceno ?? '').trim(), invoice] as const)
      .filter(([no]) => no.length > 0),
  );

  return lines.map((line) => {
    const invoiceNo = line.invoiceno;
    const row = invoiceMap.get(invoiceNo);
    return {
      invoiceno: invoiceNo,
      seqno: line.seqno,
      supplier: String(row?.supplier ?? ''),
      description: String(row?.description ?? ''),
      comment: String(row?.comment ?? ''),
      userid: String(row?.userid ?? ''),
      travelid: String(row?.travelid ?? ''),
      invoicedate: String(row?.invoicedate ?? ''),
      bookingcode: String(row?.bookingcode ?? ''),
      currency: String(row?.currency ?? ''),
      status: String(row?.status ?? ''),
      totalnetamount: parseAmount(row?.totalnetamount),
      taxamount: parseInvoiceTaxAmount(invoiceNo, row?.taxamount),
      grossamount: parseAmount(row?.grossamount),
      originalamount: parseAmount(row?.originalamount),
      originalcurrency: String(row?.originalcurrency ?? ''),
      tr_amount: normalizeLineAmount(line.tr_amount),
      trchargeable: line.trchargeable,
      txchargeable: line.txchargeable,
    };
  });
}

function parseAmount(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function isGeneratedReceiptInvoiceNo(invoiceNo: unknown): boolean {
  return /(?:^|-)\d{8}-\d{3}$/.test(String(invoiceNo ?? '').trim());
}

function parseInvoiceTaxAmount(invoiceNo: unknown, value: unknown): number | undefined {
  const amount = parseAmount(value);
  if (amount !== undefined) {
    return amount;
  }
  return isGeneratedReceiptInvoiceNo(invoiceNo) ? 0 : undefined;
}
