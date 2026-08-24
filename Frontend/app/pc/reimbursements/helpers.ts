import {
  normalizeLineAmount,
  type ReimbursementFilter,
} from '../../../services/TravelReimbursement/_shared';
import type { ReimbursementListRow } from '../../../services/TravelReimbursement/list';
import type { InvoiceListRow } from '../../../services/Invoice/list';
import type { FilterValue } from '@/components/Structures/CSmartFilter';

export interface SelectableInvoiceRow {
  invoiceno: string;
  description: string;
  amount: string;
  tr_amount?: string;
  trchargeable?: boolean;
  txchargeable?: boolean;
  originalcurrency: string;
  travelid: string;
  projectid: string;
}

export const defaultFilters: Record<string, FilterValue> = {
  id: { value: '', operator: 'contains' },
  projectid: { value: [], operator: 'anyOf' },
  userid: { value: [], operator: 'anyOf' },
  created_at: { value: [], operator: 'between' },
  bookingstatus: { value: [], operator: 'anyOf' },
  approvalstatus: { value: [], operator: 'anyOf' },
  approver: { value: [], operator: 'anyOf' },
};

export function toFilter(row: ReimbursementListRow): ReimbursementFilter {
  const rawId = row.id;
  if (typeof rawId === 'number' && Number.isFinite(rawId)) {
    return { id: rawId };
  }
  if (typeof rawId === 'string') {
    const parsed = Number(rawId);
    if (Number.isFinite(parsed)) {
      return { id: parsed };
    }
  }
  const trno = String(row.trno ?? '').trim();
  if (trno) {
    return { trno };
  }
  throw new Error('Selected reimbursement has no id or trno');
}

interface ReimbursementDetailRouter {
  push: (url: string) => void;
}

interface OpenReimbursementDetailOptions {
  invalidMessage?: string;
  onInvalid?: (message: string) => void;
  popupNamePrefix?: string;
  popupFeatures?: string;
}

function parseThemeMode(value: unknown): 'light' | 'dark' | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'light') {
    return 'light';
  }
  if (normalized === 'dark') {
    return 'dark';
  }
  return null;
}

function readCurrentThemeMode(): 'light' | 'dark' {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const docMode =
    parseThemeMode(document.documentElement.getAttribute('data-mui-color-scheme')) ??
    parseThemeMode(document.documentElement.dataset.muiColorScheme) ??
    parseThemeMode(document.documentElement.dataset.pcTheme) ??
    parseThemeMode(window.localStorage.getItem('pc_color_mode'));

  if (docMode) {
    return docMode;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function buildReimbursementDetailParams(row: ReimbursementListRow): URLSearchParams | null {
  const rawId = row.id;
  const params = new URLSearchParams();

  if (typeof rawId === 'number' && Number.isFinite(rawId)) {
    params.set('id', String(rawId));
  } else if (typeof rawId === 'string') {
    const parsed = Number(rawId);
    if (Number.isFinite(parsed)) {
      params.set('id', String(parsed));
    }
  }

  if (!params.get('id')) {
    const trno = String(row.trno ?? '').trim();
    if (trno) {
      params.set('trno', trno);
    }
  }

  if (params.size === 0) {
    return null;
  }
  return params;
}

export function openReimbursementDetail(
  row: ReimbursementListRow,
  router: ReimbursementDetailRouter,
  options?: OpenReimbursementDetailOptions,
): boolean {
  const params = buildReimbursementDetailParams(row);
  const invalidMessage = options?.invalidMessage ?? 'Invalid reimbursement record';
  if (!params) {
    options?.onInvalid?.(invalidMessage);
    return false;
  }

  params.set('mode', readCurrentThemeMode());

  const url = `/pc/reimbursements/detail?${params.toString()}`;
  if (typeof window === 'undefined') {
    router.push(url);
    return true;
  }

  const popupNamePrefix = options?.popupNamePrefix ?? 'reimbursement_detail';
  const popupFeatures =
    options?.popupFeatures ?? 'popup=yes,width=1500,height=900,left=120,top=80,resizable=yes,scrollbars=yes';
  const popup = window.open(url, `${popupNamePrefix}_${params.get('id') ?? params.get('trno') ?? 'popup'}`, popupFeatures);
  if (!popup) {
    router.push(url);
  }
  return true;
}

export function readBookingStatus(row: ReimbursementListRow): string {
  return String(row.bookingstatus ?? row.booking_status ?? row.financestatus ?? row.finance_status ?? row.status ?? '');
}

export function readApprovalStatus(row: ReimbursementListRow): string {
  return String(row.approvalstatus ?? row.approval_status ?? '');
}

export function readApprover(row: ReimbursementListRow): string {
  return String(row.approver_name ?? row.approver ?? row.approvalby ?? row.approvedby ?? '');
}

export function readCreatedAt(row: ReimbursementListRow): string {
  return String(
    row.created_at ??
      row.createdat ??
      row.createdAt ??
      row.createtime ??
      row.create_time ??
      '',
  );
}

export function readTotalAmount(row: ReimbursementListRow): number {
  const amount = Number(row.total_amount ?? row.totalAmount ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

export function readInvoiceStatus(row: InvoiceListRow): string {
  return String(row.bookingstatus ?? row.booking_status ?? row.financestatus ?? row.finance_status ?? row.status ?? '').trim().toLowerCase();
}

export function isInvoiceLockedForSelection(row: InvoiceListRow): boolean {
  const status = readInvoiceStatus(row);
  return [
    'submitted',
    'booked',
    'posted',
    'accounted',
    'closed',
    'locked',
    '已提交',
    '待记账',
    '已记账',
    '已入账',
  ].includes(status);
}

export function readInvoiceAmountText(invoice?: InvoiceListRow): string {
  if (!invoice) {
    return '';
  }
  const raw =
    invoice.grossamount ?? invoice.totalnetamount ?? invoice.totalnetamour ?? invoice.taxamount ?? '';
  return normalizeLineAmount(raw) ?? '';
}

export function readInvoiceOriginalCurrency(invoice?: InvoiceListRow): string {
  return String(invoice?.originalcurrency ?? invoice?.currency ?? 'CNY').trim().toUpperCase() || 'CNY';
}
