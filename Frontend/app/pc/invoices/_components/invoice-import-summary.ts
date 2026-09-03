import { type ImportInvoiceDraft, toNumberOrUndefined, toTrimmedString } from './shared';

export const importAmountFields = ['totalnetamount', 'taxamount', 'grossamount'] as const;

type AmountField = (typeof importAmountFields)[number];

export interface ImportCurrencySummary {
  currency: string;
  count: number;
  amounts: Record<AmountField, number | undefined>;
}

function sumAmounts(rows: ImportInvoiceDraft[], field: AmountField): number | undefined {
  let total = 0;
  for (const row of rows) {
    const amount = toNumberOrUndefined(row.payload[field]);
    if (amount === undefined) {
      return undefined;
    }
    total += amount;
  }
  return Number.isFinite(total) ? total : undefined;
}

export function summarizeImportAmounts(rows: ImportInvoiceDraft[]): ImportCurrencySummary[] {
  const groups = new Map<string, ImportInvoiceDraft[]>();
  for (const row of rows) {
    if (!row.raw || row.parseError || row.skipReason) {
      continue;
    }
    const currency = (
      toTrimmedString(row.payload.originalcurrency) || toTrimmedString(row.payload.currency)
    ).toUpperCase();
    const group = groups.get(currency) ?? [];
    group.push(row);
    groups.set(currency, group);
  }

  return Array.from(groups, ([currency, group]) => ({
    currency,
    count: group.length,
    amounts: {
      totalnetamount: sumAmounts(group, 'totalnetamount'),
      taxamount: sumAmounts(group, 'taxamount'),
      grossamount: sumAmounts(group, 'grossamount'),
    },
  })).sort((first, second) => first.currency.localeCompare(second.currency));
}

export function formatImportAmount(amount: number | undefined, currency: string, lang: 'en' | 'zh'): string {
  if (amount === undefined) {
    return '—';
  }
  const locale = lang === 'zh' ? 'zh-CN' : 'en-US';
  const fractionDigits = /^[A-Z]{3}$/.test(currency)
    ? new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits
    : 2;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}
