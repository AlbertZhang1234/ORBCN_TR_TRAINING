import { insertRows, selectRows, updateRows } from '../_core/supabaseRest';
import { ServiceError } from '../_core/error';
import { TABLES } from '../_core/tables';

export interface BookingRuleRecord extends Record<string, unknown> {
  code: string;
  category: string;
  name_zh: string;
  name_en?: string;
  description?: string;
  keywords?: string[];
  costcenter?: string;
  accountingsubject?: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface BookingRuleOption {
  code: string;
  category: string;
  labelZh: string;
  labelEn: string;
}

export async function listBookingRules(activeOnly = true): Promise<BookingRuleRecord[]> {
  return selectRows<BookingRuleRecord>(TABLES.bookingRule, {
    filters: activeOnly ? { is_active: true } : undefined,
    orderBy: { column: 'sort_order', ascending: true },
  });
}

export async function saveBookingRule(
  rule: BookingRuleRecord,
  create: boolean,
): Promise<BookingRuleRecord> {
  const code = String(rule.code ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(code)) {
    throw new ServiceError('Booking rule code must contain 2-10 uppercase letters or numbers');
  }
  if (!String(rule.name_zh ?? '').trim()) {
    throw new ServiceError('Chinese name is required');
  }

  const payload: BookingRuleRecord = {
    ...rule,
    code,
    category: String(rule.category || 'other').trim(),
    name_zh: String(rule.name_zh).trim(),
    name_en: String(rule.name_en ?? '').trim(),
    description: String(rule.description ?? '').trim(),
    keywords: Array.from(new Set((rule.keywords ?? []).map((value) => value.trim()).filter(Boolean))),
    costcenter: String(rule.costcenter ?? '').trim(),
    accountingsubject: String(rule.accountingsubject ?? '').trim(),
    sort_order: Number(rule.sort_order) || 0,
    is_active: rule.is_active !== false,
    updated_at: new Date().toISOString(),
  };

  const rows = create
    ? await insertRows<BookingRuleRecord>(TABLES.bookingRule, payload)
    : await updateRows<BookingRuleRecord>(TABLES.bookingRule, { code }, payload);
  if (!rows[0]) {
    throw new ServiceError(`Failed to save booking rule ${code}`);
  }
  return rows[0];
}

export function toBookingRuleOptions(rules: BookingRuleRecord[]): BookingRuleOption[] {
  return rules
    .map((rule) => ({
      code: String(rule.code ?? '').trim(),
      category: String(rule.category ?? 'other'),
      labelZh: String(rule.name_zh || rule.name_en || rule.code).trim(),
      labelEn: String(rule.name_en || rule.name_zh || rule.code).trim(),
    }))
    .filter((option) => option.code.length > 0);
}

export function formatBookingRuleOption(
  option: BookingRuleOption,
  lang: 'en' | 'zh',
): string {
  return `${option.code} - ${lang === 'zh' ? option.labelZh : option.labelEn}`;
}
