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

async function fetchRate(originalCurrency: string, targetCurrency: string): Promise<number> {
  if (originalCurrency === targetCurrency) {
    return 1;
  }

  const apiKey = readApiKey();
  if (!apiKey) {
    throw new Error('exchg_apikey is required for invoice currency conversion');
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

  const rate = Number(payload.conversion_rates?.[targetCurrency]);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Exchange rate ${originalCurrency}->${targetCurrency} is not available`);
  }

  return rate;
}

function appendConversionComment(comment: unknown, sourceCurrency: string, targetCurrency: string, rate: number): string {
  const current = String(comment ?? '').trim();
  if (sourceCurrency === targetCurrency || rate === 1) {
    return current;
  }
  const note = `Converted amounts from ${sourceCurrency} to ${targetCurrency} at rate ${rate}.`;
  return current ? `${current}\n${note}` : note;
}

async function normalizeInvoiceCurrency(payload: InvoiceRecord, amountCurrency?: string): Promise<InvoiceRecord> {
  const originalCurrency =
    normalizeCurrency(payload.originalcurrency) ||
    normalizeCurrency(payload.currency) ||
    LOCAL_CURRENCY;
  const targetCurrency = normalizeCurrency(payload.currency) || originalCurrency;
  const sourceCurrency = normalizeCurrency(amountCurrency) || originalCurrency;

  const originalAmount =
    toFiniteNumber(payload.originalamount) ??
    toFiniteNumber(payload.grossamount) ??
    toFiniteNumber(payload.totalnetamount) ??
    toFiniteNumber(payload.taxamount);

  const next: InvoiceRecord = {
    ...payload,
    currency: targetCurrency,
    originalcurrency: originalCurrency,
  };

  if (originalAmount !== undefined) {
    next.originalamount = roundMoney(originalAmount);
  }

  if (sourceCurrency === targetCurrency) {
    if (
      sourceCurrency === originalCurrency &&
      toFiniteNumber(payload.grossamount) === undefined &&
      originalAmount !== undefined
    ) {
      next.grossamount = roundMoney(originalAmount);
    }
    return next;
  }

  const rate = await fetchRate(sourceCurrency, targetCurrency);
  const gross = toFiniteNumber(payload.grossamount);
  const net = toFiniteNumber(payload.totalnetamount);
  const tax = toFiniteNumber(payload.taxamount);
  if (gross !== undefined) {
    next.grossamount = roundMoney(gross * rate);
  } else if (sourceCurrency === originalCurrency && originalAmount !== undefined) {
    next.grossamount = roundMoney(originalAmount * rate);
  }
  if (net !== undefined) next.totalnetamount = roundMoney(net * rate);
  if (tax !== undefined) next.taxamount = roundMoney(tax * rate);
  next.comment = appendConversionComment(payload.comment, sourceCurrency, targetCurrency, rate);

  return next;
}

interface NormalizeCurrencyRequest {
  invoice?: InvoiceRecord;
  amountCurrency?: string;
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const body = (await request.json()) as NormalizeCurrencyRequest & InvoiceRecord;
    const payload = body.invoice ?? body;
    return NextResponse.json(
      await normalizeInvoiceCurrency(payload, body.invoice ? body.amountCurrency : undefined),
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invoice currency normalization failed';
    return NextResponse.json({ message }, { status: 500 });
  }
}
