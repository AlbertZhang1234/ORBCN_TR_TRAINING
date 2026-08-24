import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/services/_server/apiAuth';
import type { InvoiceRecord } from '@/services/Invoice/_shared';

const LOCAL_CURRENCY = 'CNY';

function normalizeCurrency(value: unknown): string {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) {
    return '';
  }
  if (raw === 'RMB' || raw === 'CNH' || raw === 'YUAN' || raw === '人民币') {
    return LOCAL_CURRENCY;
  }
  if (raw === '欧元') return 'EUR';
  if (raw === '美元') return 'USD';
  if (raw === '日元' || raw === '日圆') return 'JPY';
  return raw.replace(/[^A-Z]/g, '').slice(0, 3);
}

function toFiniteNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function readApiKey(): string {
  return (
    process.env.exchg_apikey ??
    process.env.EXCHG_APIKEY ??
    process.env.EXCHG_API_KEY ??
    ''
  ).trim();
}

async function fetchRateToCny(originalCurrency: string): Promise<number> {
  if (originalCurrency === LOCAL_CURRENCY) {
    return 1;
  }

  const apiKey = readApiKey();
  if (!apiKey) {
    throw new Error('exchg_apikey is required for foreign currency invoice conversion');
  }

  const response = await fetch(
    `https://v6.exchangerate-api.com/v6/${encodeURIComponent(apiKey)}/latest/${encodeURIComponent(originalCurrency)}`,
    { cache: 'no-store' },
  );
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload || payload.result === 'error') {
    const errorType = payload && typeof payload === 'object' ? String(payload['error-type'] ?? '') : '';
    throw new Error(`Exchange rate lookup failed for ${originalCurrency}${errorType ? `: ${errorType}` : ''}`);
  }

  const cnyRate = Number(payload.conversion_rates?.[LOCAL_CURRENCY]);
  if (!Number.isFinite(cnyRate) || cnyRate <= 0) {
    throw new Error(`Exchange rate ${originalCurrency}->${LOCAL_CURRENCY} is not available`);
  }

  return cnyRate;
}

function appendConversionComment(comment: unknown, originalCurrency: string, rate: number): string {
  const current = String(comment ?? '').trim();
  if (originalCurrency === LOCAL_CURRENCY || rate === 1) {
    return current;
  }
  const note = `Original currency ${originalCurrency}; converted to ${LOCAL_CURRENCY} at rate ${rate}.`;
  return current ? `${current}\n${note}` : note;
}

async function normalizeInvoiceCurrency(payload: InvoiceRecord): Promise<InvoiceRecord> {
  const originalCurrency =
    normalizeCurrency(payload.originalcurrency) ||
    normalizeCurrency(payload.currency) ||
    LOCAL_CURRENCY;

  const originalAmount =
    toFiniteNumber(payload.originalamount) ??
    toFiniteNumber(payload.grossamount) ??
    toFiniteNumber(payload.totalnetamount) ??
    toFiniteNumber(payload.taxamount);

  const rate = await fetchRateToCny(originalCurrency);
  const next: InvoiceRecord = {
    ...payload,
    currency: LOCAL_CURRENCY,
    originalcurrency: originalCurrency,
  };

  if (originalAmount !== undefined) {
    next.originalamount = roundMoney(originalAmount);
  }

  if (originalCurrency === LOCAL_CURRENCY && toFiniteNumber(payload.grossamount) === undefined && originalAmount !== undefined) {
    next.grossamount = roundMoney(originalAmount);
  }

  if (originalCurrency !== LOCAL_CURRENCY) {
    const gross = toFiniteNumber(payload.grossamount);
    const net = toFiniteNumber(payload.totalnetamount);
    const tax = toFiniteNumber(payload.taxamount);
    if (gross !== undefined) {
      next.grossamount = roundMoney(gross * rate);
    } else if (originalAmount !== undefined) {
      next.grossamount = roundMoney(originalAmount * rate);
    }
    if (net !== undefined) next.totalnetamount = roundMoney(net * rate);
    if (tax !== undefined) next.taxamount = roundMoney(tax * rate);
    next.comment = appendConversionComment(payload.comment, originalCurrency, rate);
  }

  return next;
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const payload = (await request.json()) as InvoiceRecord;
    return NextResponse.json(await normalizeInvoiceCurrency(payload), { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invoice currency normalization failed';
    return NextResponse.json({ message }, { status: 500 });
  }
}
