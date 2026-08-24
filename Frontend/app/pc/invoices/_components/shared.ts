
import type { InvoiceRecord } from '../../../../services/Invoice/_shared';
import type { InvoiceParseResult } from '../../../../services/Invoice/parse';
import type { InvoiceListRow } from '../../../../services/Invoice/list';
import { normalizeWorkflowStatus } from '../../../../services/_core/locks';

export interface ImportInvoiceDraft {
  id: string;
  fileName: string;
  sourceFile: File;
  payload: InvoiceRecord;
  raw?: InvoiceParseResult;
  parseError?: string;
  skipReason?: string;
}

export function toTrimmedString(value: unknown): string {
  return String(value ?? '').trim();
}

export function toNumberOrUndefined(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function readStatus(row: InvoiceListRow): string {
  return String(
    row.bookingstatus ??
      row.booking_status ??
      row.financestatus ??
      row.finance_status ??
      row.status ??
      '',
  );
}

export function statusLabel(status: ReturnType<typeof normalizeWorkflowStatus>, t: (key: string, fallback: string) => string): string {
  if (status === 'WAIT FOR APPROVAL') {
    return t('stat_wait_approval', 'Waiting');
  }
  if (status === 'APPROVED' || status === 'BOOKED') {
    return t('stat_approved', 'Approved');
  }
  if (status === 'REJECTED') {
    return t('rejected', 'Rejected');
  }
  if (status === 'SUBMITTED') {
    return t('submitted', 'Submitted');
  }
  return t('pending', 'Pending');
}

export function normalizeImportDrafts(
  drafts: ImportInvoiceDraft[],
  existingInvoiceNos: Set<string>,
  t: (key: string, fallback: string) => string
): ImportInvoiceDraft[] {
  const counts = new Map<string, number>();
  for (const draft of drafts) {
    const invoiceNo = toTrimmedString(draft.payload.invoiceno);
    if (!invoiceNo) {
      continue;
    }
    counts.set(invoiceNo, (counts.get(invoiceNo) ?? 0) + 1);
  }

  return drafts.map((draft) => {
    const invoiceNo = toTrimmedString(draft.payload.invoiceno);
    let skipReason = '';

    if (draft.parseError) {
      skipReason = draft.parseError;
    } else if (!invoiceNo) {
      skipReason = t('invoice_no_not_found', 'Invoice No not found');
    } else if (existingInvoiceNos.has(invoiceNo)) {
      skipReason = t('invoice_no_exists', 'Invoice No exists');
    } else if ((counts.get(invoiceNo) ?? 0) > 1) {
      skipReason = t('duplicate_invoice_no_import', 'Duplicate Invoice No in import');
    } else if (!toTrimmedString(draft.payload.userid)) {
      skipReason = t('user_id_empty', 'User ID is empty');
    }

    return { ...draft, skipReason: skipReason || undefined };
  });
}
