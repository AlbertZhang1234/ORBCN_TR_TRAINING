export const DEFAULT_BUSINESS_TYPE = '03';

export const BUSINESS_TYPE_OPTIONS = [
  { code: '01', labelKey: 'business_type_standard_purchase_invoice', label: 'Standard Purchase Invoice' },
  { code: '02', labelKey: 'business_type_freight_subsequent_debit', label: 'Freight/Subsequent Debit' },
  { code: '03', labelKey: 'business_type_reimbursement', label: 'Reimbursement' },
] as const;

export type BusinessTypeCode = (typeof BUSINESS_TYPE_OPTIONS)[number]['code'];

const BUSINESS_TYPE_CODES = new Set<string>(BUSINESS_TYPE_OPTIONS.map((option) => option.code));

export function normalizeBusinessType(value: unknown): BusinessTypeCode {
  const normalized = String(value ?? '').trim();
  return BUSINESS_TYPE_CODES.has(normalized)
    ? (normalized as BusinessTypeCode)
    : DEFAULT_BUSINESS_TYPE;
}

export function isBusinessType(value: unknown): value is BusinessTypeCode {
  return BUSINESS_TYPE_CODES.has(String(value ?? '').trim());
}

export function formatBusinessTypeOption(
  option: (typeof BUSINESS_TYPE_OPTIONS)[number],
  t: (key: string, fallback: string) => string,
): string {
  return `${option.code}-${t(option.labelKey, option.label)}`;
}
