import { ServiceError } from '../_core/error';
import { ensureRecordMutable } from '../_core/locks';
import { deleteRows, insertRows, selectOne, selectRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export interface ReimbursementHeader extends Record<string, unknown> {
  id?: number;
  trno?: string;
  projectid?: string;
}

export interface ReimbursementLine extends Record<string, unknown> {
  id?: number;
  invoiceno: string;
  tr_amount?: string;
  trchargeable?: boolean;
  txchargeable?: boolean;
}

export interface ReimbursementLineInput {
  invoiceno: string;
  tr_amount?: string | number | null;
  trchargeable?: boolean | string | number | null;
  txchargeable?: boolean | string | number | null;
}

export interface ReimbursementFilter {
  id?: number;
  trno?: string;
}

export function getHeaderFilter(filter: ReimbursementFilter): Record<string, string | number> {
  if (typeof filter.id === 'number') {
    return { id: filter.id };
  }

  if (filter.trno?.trim()) {
    return { trno: filter.trno.trim() };
  }

  throw new ServiceError('Reimbursement filter requires id or trno');
}

export async function getReimbursementHeader(
  filter: ReimbursementFilter,
): Promise<ReimbursementHeader | null> {
  return selectOne<ReimbursementHeader>(TABLES.reimbursementHeader, getHeaderFilter(filter));
}

export function assertHeaderMutable(header: ReimbursementHeader): void {
  ensureRecordMutable(header, 'Reimbursement');
}

export function buildLinePayloadCandidates(
  header: ReimbursementHeader,
  invoiceNo: string,
  trAmount?: string | number | null,
  trChargeable?: boolean | string | number | null,
  txChargeable?: boolean | string | number | null,
): Array<Record<string, unknown>> {
  const headerId = Number(header.id);
  if (!Number.isFinite(headerId)) {
    throw new ServiceError('Reimbursement header id is required to insert line items');
  }
  const payload: Record<string, unknown> = { id: headerId, invoiceno: invoiceNo };
  const normalizedAmount = normalizeLineAmount(trAmount);
  if (normalizedAmount !== undefined) {
    payload.tr_amount = normalizedAmount;
  }
  const normalizedTrChargeable = normalizeChargeableFlag(trChargeable);
  if (normalizedTrChargeable !== undefined) {
    payload.trchargeable = normalizedTrChargeable;
  }
  const normalizedTxChargeable = normalizeChargeableFlag(txChargeable);
  if (normalizedTxChargeable !== undefined) {
    payload.txchargeable = normalizedTxChargeable;
  }
  return [payload];
}

export async function insertLineWithFallback(
  header: ReimbursementHeader,
  invoiceNo: string,
  trAmount?: string | number | null,
  trChargeable?: boolean | string | number | null,
  txChargeable?: boolean | string | number | null,
): Promise<ReimbursementLine> {
  const payloads = buildLinePayloadCandidates(
    header,
    invoiceNo,
    trAmount,
    trChargeable,
    txChargeable,
  );

  for (const payload of payloads) {
    const rows = await insertRows<ReimbursementLine>(TABLES.reimbursementLine, payload);
    if (rows[0]) {
      return rows[0];
    }
  }

  throw new ServiceError(`Failed to insert reimbursement line for invoice ${invoiceNo}`);
}

export function normalizeLineAmount(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    // Accept common user input formats (e.g. 1,234.56 / 1，234.56) and
    // normalize to a DB-friendly numeric string.
    const normalized = trimmed.replace(/[，,]/g, '');
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      return undefined;
    }
    return normalized;
  }
  return undefined;
}

export function normalizeChargeableFlag(value: unknown): boolean | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return undefined;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }
    if (['true', 't', '1', 'yes', 'y', '是'].includes(normalized)) {
      return true;
    }
    if (['false', 'f', '0', 'no', 'n', '否'].includes(normalized)) {
      return false;
    }
  }
  return undefined;
}

export async function getLineRowsByHeader(
  header: ReimbursementHeader,
): Promise<ReimbursementLine[]> {
  const headerId = Number(header.id);
  if (!Number.isFinite(headerId)) {
    return [];
  }

  const rows = await selectRows<ReimbursementLine>(TABLES.reimbursementLine, {
    select: 'invoiceno,tr_amount,trchargeable,txchargeable',
    filters: { id: headerId },
  });

  return rows
    .map((row) => ({
      invoiceno: String(row.invoiceno ?? '').trim(),
      tr_amount: normalizeLineAmount(row.tr_amount),
      trchargeable: normalizeChargeableFlag(row.trchargeable),
      txchargeable: normalizeChargeableFlag(row.txchargeable),
    }))
    .filter((row) => row.invoiceno.length > 0);
}

export async function getLineInvoicesByHeader(
  header: ReimbursementHeader,
): Promise<string[]> {
  const rows = await getLineRowsByHeader(header);
  return Array.from(
    new Set(rows.map((row) => String(row.invoiceno ?? '')).filter((v) => v.length > 0)),
  );
}

export async function deleteLinesByInvoices(invoiceNos: string[]): Promise<void> {
  for (const invoiceNo of invoiceNos) {
    await deleteRows(TABLES.reimbursementLine, { invoiceno: invoiceNo });
  }
}

export async function deleteLinesByHeader(header: ReimbursementHeader): Promise<void> {
  const headerId = Number(header.id);
  if (!Number.isFinite(headerId)) {
    return;
  }
  await deleteRows(TABLES.reimbursementLine, { id: headerId });
}
