import type { InvoiceParseResult } from './parse';

export type DraftStatus = 'queued' | 'recognizing' | 'ready' | 'editing' | 'confirmed' | 'saved' | 'error';
export type SupplierBusinessType = '01' | '02';
export interface EditableLine {
  key: string;
  description: string;
  spec_model: string;
  unit_price: number | null;
  quantity: number | null;
  amount_excl_tax: number | null;
  tax_rate: string;
  amount_incl_tax: number | null;
}
export interface EditableHeader {
  invoiceno: string;
  invoicedate: string;
  supplier: string;
  description: string;
  comment: string;
  bookingcode: string;
  businesstype: SupplierBusinessType;
  currency: string;
  totalnetamount: number | null;
  taxamount: number | null;
  grossamount: number | null;
}
export interface SupplierInvoiceDraft {
  id: string;
  filename: string;
  status: DraftStatus;
  header: EditableHeader;
  lines: EditableLine[];
  error?: string;
  version: number;
  saved_invoice_no?: string;
}
export const emptyHeader = (businesstype: SupplierBusinessType): EditableHeader => ({
  invoiceno: '', invoicedate: '', supplier: '', description: '', comment: '', bookingcode: '',
  businesstype, currency: 'CNY', totalnetamount: null, taxamount: null, grossamount: null,
});
const numberOrNull = (value: unknown): number | null => {
  const parsed = Number(value);
  return value === '' || value === null || value === undefined || !Number.isFinite(parsed) ? null : parsed;
};
export function recognizedContent(header: EditableHeader, parsed: InvoiceParseResult) {
  const lines: EditableLine[] = (parsed.line_items ?? []).map((line, index) => ({
    key: `line-${index + 1}`, description: String(line.description ?? '').trim(),
    spec_model: String(line.spec_model ?? '').trim(), unit_price: numberOrNull(line.unit_price),
    quantity: numberOrNull(line.quantity), amount_excl_tax: numberOrNull(line.amount_excl_tax),
    tax_rate: String(line.tax_rate ?? '').trim(), amount_incl_tax: numberOrNull(line.amount_incl_tax),
  }));
  return { lines, header: {
    ...header, invoiceno: String(parsed.invoice_number ?? '').trim(),
    invoicedate: String(parsed.issue_date ?? '').slice(0, 10), supplier: String(parsed.seller_name ?? '').trim(),
    description: lines[0]?.description ?? '', bookingcode: String(parsed.category_code ?? '').trim(),
    currency: String(parsed.currency || 'CNY').trim().toUpperCase(),
    totalnetamount: numberOrNull(parsed.amount_excl_tax), taxamount: numberOrNull(parsed.tax_amount),
    grossamount: numberOrNull(parsed.amount_incl_tax),
  } };
}
export function validateDraft(draft: Pick<SupplierInvoiceDraft, 'header' | 'lines'>): string[] {
  const errors: string[] = [];
  if (!draft.header.invoiceno.trim()) errors.push('发票号码不能为空');
  if (!['01', '02'].includes(draft.header.businesstype)) errors.push('业务类型只能是 01 或 02');
  if (!draft.lines.length) errors.push('至少需要一个发票行项目');
  draft.lines.forEach((line, index) => {
    if (!line.description.trim()) errors.push(`第 ${index + 1} 行的项目名称不能为空`);
  });
  return errors;
}
export function reconciliationWarnings(draft: Pick<SupplierInvoiceDraft, 'header' | 'lines'>): string[] {
  if (!draft.lines.length) return [];
  const net = draft.lines.reduce((sum, line) => sum + (line.amount_excl_tax ?? 0), 0);
  const gross = draft.lines.reduce((sum, line) => sum + (line.amount_incl_tax ?? 0), 0);
  const warnings: string[] = [];
  if (draft.header.totalnetamount !== null && Math.abs(draft.header.totalnetamount - net) > 0.01)
    warnings.push(`行项目未税合计 ${net.toFixed(2)} 与抬头不一致`);
  if (draft.header.grossamount !== null && Math.abs(draft.header.grossamount - gross) > 0.01)
    warnings.push(`行项目含税合计 ${gross.toFixed(2)} 与抬头不一致`);
  return warnings;
}
export function lineForSave({ key, ...line }: EditableLine, index: number) {
  return { ...line, line_no: index + 1 };
}
export function nextEditableIndex(drafts: SupplierInvoiceDraft[], current: number): number {
  for (let offset = 1; offset <= drafts.length; offset += 1) {
    const index = (current + offset) % drafts.length;
    if (!['confirmed', 'saved', 'queued', 'recognizing'].includes(drafts[index].status)) return index;
  }
  return current;
}
