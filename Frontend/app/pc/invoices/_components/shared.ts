
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
  generatedInvoiceNo?: boolean;
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

function normalizeInvoiceNumberPart(value: unknown): string {
  return toTrimmedString(value)
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .slice(0, 24);
}

export function isGeneratedReceiptInvoiceNo(invoiceNo: unknown): boolean {
  return /(?:^|-)\d{8}-\d{3}$/.test(toTrimmedString(invoiceNo));
}

export function normalizeReceiptTaxAmount(invoiceNo: unknown, taxAmount: unknown): number | undefined {
  if (
    (taxAmount === null || taxAmount === undefined || taxAmount === '') &&
    isGeneratedReceiptInvoiceNo(invoiceNo)
  ) {
    return 0;
  }
  return toNumberOrUndefined(taxAmount);
}

export function formatLocalDate(value = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

export function formatDateOnly(value: unknown): string {
  const text = toTrimmedString(value);
  if (!text) {
    return '';
  }

  const datePart = text.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (datePart?.[1]) {
    return datePart[1];
  }

  const slashDate = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slashDate) {
    return `${slashDate[1]}-${slashDate[2].padStart(2, '0')}-${slashDate[3].padStart(2, '0')}`;
  }

  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) {
    return text;
  }

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(parsed));
}

function formatInvoiceNumberDate(value: unknown): string {
  const text = toTrimmedString(value);
  const match = text.match(/(\d{4})[年\-/\.](\d{1,2})[月\-/\.](\d{1,2})/);
  if (match) {
    return `${match[1]}${match[2].padStart(2, '0')}${match[3].padStart(2, '0')}`;
  }

  const compactMatch = text.match(/(\d{4})(\d{2})(\d{2})/);
  if (compactMatch) {
    return `${compactMatch[1]}${compactMatch[2]}${compactMatch[3]}`;
  }

  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) {
    const date = new Date(parsed);
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('');
  }

  return formatLocalDate().replaceAll('-', '');
}

function generatedInvoiceNumberMatchesDate(invoiceNo: string, invoiceDate: unknown): boolean {
  const match = invoiceNo.match(/-(\d{8})-\d{3}$/);
  return Boolean(match && match[1] === formatInvoiceNumberDate(invoiceDate));
}

function buildGeneratedInvoiceNo(draft: ImportInvoiceDraft, usedInvoiceNos: Set<string>): string {
  const supplierNumber =
    normalizeInvoiceNumberPart(draft.raw?.seller_tax_no) ||
    normalizeInvoiceNumberPart(draft.raw?.seller_name) ||
    'RECEIPT';
  const datePart = formatInvoiceNumberDate(draft.payload.invoicedate || draft.raw?.issue_date);
  const base = `${supplierNumber}-${datePart}`;

  let sequence = 1;
  let candidate = '';
  do {
    candidate = `${base}-${String(sequence).padStart(3, '0')}`;
    sequence += 1;
  } while (usedInvoiceNos.has(candidate));

  usedInvoiceNos.add(candidate);
  return candidate;
}

export function normalizeImportDrafts(
  drafts: ImportInvoiceDraft[],
  existingInvoiceNos: Set<string>,
  t: (key: string, fallback: string) => string
): ImportInvoiceDraft[] {
  const usedInvoiceNos = new Set(existingInvoiceNos);
  const fallbackDate = formatLocalDate();
  for (const draft of drafts) {
    const invoiceNo = toTrimmedString(draft.payload.invoiceno);
    if (invoiceNo) {
      usedInvoiceNos.add(invoiceNo);
    }
  }

  const normalizedDrafts = drafts.map((draft) => {
    const invoiceDate = toTrimmedString(draft.payload.invoicedate);
    const normalizedDraft =
      !draft.parseError && !invoiceDate
        ? {
            ...draft,
            payload: {
              ...draft.payload,
              invoicedate: fallbackDate,
            },
          }
        : draft;
    const invoiceNo = toTrimmedString(normalizedDraft.payload.invoiceno);
    if (normalizedDraft.parseError) {
      return normalizedDraft;
    }

    if (
      normalizedDraft.generatedInvoiceNo &&
      invoiceNo &&
      !generatedInvoiceNumberMatchesDate(invoiceNo, normalizedDraft.payload.invoicedate)
    ) {
      const draftWithoutGeneratedNo = {
        ...normalizedDraft,
        payload: {
          ...normalizedDraft.payload,
          invoiceno: '',
        },
      };
      const generatedInvoiceNo = buildGeneratedInvoiceNo(draftWithoutGeneratedNo, usedInvoiceNos);
      return {
        ...draftWithoutGeneratedNo,
        payload: {
          ...draftWithoutGeneratedNo.payload,
          invoiceno: generatedInvoiceNo,
          taxamount: normalizeReceiptTaxAmount(generatedInvoiceNo, draftWithoutGeneratedNo.payload.taxamount),
        },
      };
    }

    if (invoiceNo || normalizedDraft.generatedInvoiceNo) {
      return {
        ...normalizedDraft,
        payload: {
          ...normalizedDraft.payload,
          taxamount: normalizeReceiptTaxAmount(invoiceNo, normalizedDraft.payload.taxamount),
        },
      };
    }

    const generatedInvoiceNo = buildGeneratedInvoiceNo(normalizedDraft, usedInvoiceNos);
    return {
      ...normalizedDraft,
      generatedInvoiceNo: true,
      payload: {
        ...normalizedDraft.payload,
        invoiceno: generatedInvoiceNo,
        taxamount: normalizeReceiptTaxAmount(generatedInvoiceNo, normalizedDraft.payload.taxamount),
      },
    };
  });

  const counts = new Map<string, number>();
  for (const draft of normalizedDrafts) {
    const invoiceNo = toTrimmedString(draft.payload.invoiceno);
    if (!invoiceNo) {
      continue;
    }
    counts.set(invoiceNo, (counts.get(invoiceNo) ?? 0) + 1);
  }

  return normalizedDrafts.map((draft) => {
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
