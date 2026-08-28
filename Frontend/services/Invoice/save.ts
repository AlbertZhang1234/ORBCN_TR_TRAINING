import { ServiceError } from '../_core/error';
import { requireTravelEntry, requireUser, readStringCandidate } from '../_core/dependencies';
import { insertRows, updateRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';
import { getClientSessionId } from '../_core/session';
import { normalizeBusinessType } from './business-types';
import {
  ensureInvoiceContentMutable,
  getInvoiceByNo,
  InvoiceRecord,
  readInvoiceWorkflowStatus,
} from './_shared';

function omitImmutableFields(payload: Record<string, unknown>): Record<string, unknown> {
  const next = { ...payload };
  delete next.invoiceno;
  return next;
}

async function normalizeCurrencyForSave(payload: InvoiceRecord, amountCurrency?: string): Promise<InvoiceRecord> {
  if (typeof window === 'undefined') {
    return payload;
  }

  const response = await fetch('/api/invoice/normalize-currency', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': getClientSessionId(),
    },
    body: JSON.stringify({ invoice: payload, amountCurrency }),
  });

  if (!response.ok) {
    let message = `Invoice currency normalization failed (${response.status})`;
    try {
      const data = await response.json();
      if (typeof data?.message === 'string' && data.message.trim()) {
        message = data.message;
      }
    } catch {
      // keep default message
    }
    throw new ServiceError(message);
  }

  return (await response.json()) as InvoiceRecord;
}

export async function saveInvoice(payload: InvoiceRecord): Promise<InvoiceRecord> {
  const preparedPayload: InvoiceRecord = {
    ...payload,
    businesstype: normalizeBusinessType(payload.businesstype),
  };

  if (!preparedPayload.invoiceno?.trim()) {
    throw new ServiceError('invoiceno is required');
  }

  const existing = await getInvoiceByNo(preparedPayload.invoiceno);
  const normalizedPayload = await normalizeCurrencyForSave(
    preparedPayload,
    existing ? String(existing.currency ?? '') : undefined,
  );
  if (!existing) {
    const userId = readStringCandidate(normalizedPayload, ['userid', 'user_id']);
    if (!userId) {
      throw new ServiceError('userid is required. Create user first.');
    }
    await requireUser(userId);

    const travelId = readStringCandidate(normalizedPayload, ['travelid', 'travel_id']);
    if (travelId) {
      await requireTravelEntry(travelId);
    }

    const insertPayload: InvoiceRecord = { ...normalizedPayload };
    insertPayload.status = readInvoiceWorkflowStatus(insertPayload as InvoiceRecord);
    const inserted = await insertRows<InvoiceRecord>(TABLES.invoice, insertPayload);
    if (!inserted[0]) {
      throw new ServiceError('saveInvoice insert failed: no row returned');
    }
    return inserted[0];
  }

  ensureInvoiceContentMutable(existing);

  const patch = omitImmutableFields(normalizedPayload);
  if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
    patch.status = readInvoiceWorkflowStatus(patch as InvoiceRecord);
  }
  if (Object.keys(patch).length === 0) {
    return existing;
  }

  const updated = await updateRows<InvoiceRecord>(
    TABLES.invoice,
    { invoiceno: normalizedPayload.invoiceno },
    patch,
  );

  if (!updated[0]) {
    throw new ServiceError(`saveInvoice update failed for invoice ${normalizedPayload.invoiceno}`);
  }

  return updated[0];
}

export async function saveInvoiceBookingRule(
  invoiceNo: string,
  bookingCode: string | null | undefined,
): Promise<InvoiceRecord> {
  const normalizedInvoiceNo = String(invoiceNo ?? '').trim();
  if (!normalizedInvoiceNo) {
    throw new ServiceError('invoiceno is required');
  }

  const existing = await getInvoiceByNo(normalizedInvoiceNo);
  if (!existing) {
    throw new ServiceError(`Invoice ${normalizedInvoiceNo} not found`);
  }

  const normalizedBookingCode = String(bookingCode ?? '').trim();
  const patch: Record<string, unknown> = {
    bookingcode: normalizedBookingCode || null,
  };

  const updated = await updateRows<InvoiceRecord>(
    TABLES.invoice,
    { invoiceno: normalizedInvoiceNo },
    patch,
  );

  if (!updated[0]) {
    throw new ServiceError(`saveInvoiceBookingRule update failed for invoice ${normalizedInvoiceNo}`);
  }

  return updated[0];
}
