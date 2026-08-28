import { ServiceError } from '../_core/error';
import {
  readStringCandidate,
  requireProject,
  requireTravelEntry,
  requireUser,
} from '../_core/dependencies';
import type { ProjectRow } from '../_core/dependencies';
import { normalizeWorkflowStatus, readFirstExisting } from '../_core/locks';
import { deleteRows, insertRows, selectRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';
import {
  getInvoiceByNo,
  InvoiceRecord,
  readInvoiceWorkflowStatus,
  setInvoiceStatus,
} from '../Invoice/_shared';

import {
  deleteLinesByHeader,
  insertLineWithFallback,
  ReimbursementHeader,
  ReimbursementLine,
  ReimbursementLineInput,
  normalizeChargeableFlag,
  normalizeLineAmount,
  assertInvoiceSaveCurrencyConsistency,
} from './_shared';
import { sendReimbursementApprovalRequestEmail, sendReimbursementEmail } from './approve';

export interface CreateTravelReimbursementInput {
  header: Record<string, unknown>;
  invoiceNos?: string[];
  lines?: ReimbursementLineInput[];
}

export interface CreateTravelReimbursementResult {
  header: ReimbursementHeader;
  lines: ReimbursementLine[];
}

const APPROVER_FIELD_CANDIDATES = ['approver', 'approvalby', 'approvedby'] as const;
const HEADER_BOOKING_STATUS_CANDIDATES = ['bookingstatus', 'booking_status', 'status'] as const;
const HEADER_APPROVAL_STATUS_CANDIDATES = ['approvalstatus', 'approval_status'] as const;
const MAX_REIMBURSEMENT_ID = 99_999_999;
const CREATE_ID_RETRY_LIMIT = 8;
const APPROVAL_STATUS_CANDIDATES = ['approvalstatus', 'approval_status'];

interface PreparedInvoice {
  invoice: InvoiceRecord;
  trAmount?: string;
  trChargeable?: boolean;
  txChargeable?: boolean;
}

function normalizeHeaderBookingStatus(raw: string | null): string {
  const normalized = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!normalized || normalized === 'open') {
    return 'OPEN';
  }
  if (normalized === 'booked' || normalized === 'posted' || normalized === 'accounted') {
    return 'BOOKED';
  }
  return raw ?? 'OPEN';
}

function normalizeHeaderApprovalStatus(raw: string | null): string {
  const normalized = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (
    !normalized ||
    normalized === 'wait for approval' ||
    normalized === 'waiting for approval' ||
    normalized === 'waitforapproval' ||
    normalized === 'pending' ||
    normalized === 'open'
  ) {
    return 'Wait for Approval';
  }
  if (normalized === 'approved') {
    return 'APPROVED';
  }
  if (normalized === 'rejected') {
    return 'REJECTED';
  }
  return raw ?? 'Wait for Approval';
}

function isHeaderApproved(header: ReimbursementHeader): boolean {
  const raw = readFirstExisting(header, APPROVAL_STATUS_CANDIDATES);
  return normalizeWorkflowStatus(raw) === 'APPROVED';
}

function buildHeaderInsertPayload(
  header: Record<string, unknown>,
  reimbursementId: number,
  userId: string,
  projectId: string,
  defaultApprover: string | null,
  forceApproved: boolean,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: reimbursementId,
    userid: userId,
    projectid: projectId,
    trno: String(reimbursementId),
  };

  const createdAt = readStringCandidate(header, ['created_at', 'createdat']) ?? new Date().toISOString();
  payload.created_at = createdAt;

  const bookingStatus = readStringCandidate(header, [...HEADER_BOOKING_STATUS_CANDIDATES]);
  payload.bookingstatus = normalizeHeaderBookingStatus(bookingStatus);

  if (forceApproved) {
    payload.approvalstatus = 'APPROVED';
  } else {
    const approvalStatus = readStringCandidate(header, [...HEADER_APPROVAL_STATUS_CANDIDATES]);
    payload.approvalstatus = normalizeHeaderApprovalStatus(approvalStatus);
  }

  const approver = readStringCandidate(header, [...APPROVER_FIELD_CANDIDATES]) ?? defaultApprover;
  if (approver) {
    payload.approver = approver;
  }

  return payload;
}

function normalizeId(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return 0;
}

function readSessionIdFromBrowser(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem('pc_session_user');
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { session_id?: unknown };
    const sessionId = String(parsed?.session_id ?? '').trim();
    return sessionId || null;
  } catch {
    return null;
  }
}

async function fetchNextReimbursementIdFromApi(): Promise<number | null> {
  if (typeof window === 'undefined') {
    return null;
  }
  const sessionId = readSessionIdFromBrowser();
  if (!sessionId) {
    return null;
  }

  const response = await fetch('/api/reimbursement/next-id', {
    method: 'GET',
    headers: {
      'x-session-id': sessionId,
    },
  });
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { nextId?: unknown };
  const nextId = normalizeId(payload?.nextId);
  if (nextId <= 0) {
    return null;
  }
  return nextId;
}

async function buildNextReimbursementId(): Promise<number> {
  // In browser create flow, id must come from backend MAX(id)+1 API to avoid
  // any visibility/filtering or string-order issues on client side.
  if (typeof window !== 'undefined') {
    const apiNextId = await fetchNextReimbursementIdFromApi().catch(() => null);
    if (!(typeof apiNextId === 'number' && Number.isFinite(apiNextId) && apiNextId > 0)) {
      throw new ServiceError('Failed to allocate next reimbursement id from server');
    }
    if (apiNextId > MAX_REIMBURSEMENT_ID) {
      throw new ServiceError('Reimbursement id exceeded allowed range 00000001-99999999');
    }
    return Math.trunc(apiNextId);
  }

  // ID generation rule:
  // Use current max(otto_tr_h.id) + 1. Do NOT use trno or line-table ids.
  const headerRows = await selectRows<Record<string, unknown>>(TABLES.reimbursementHeader, {
    select: 'id',
    orderBy: { column: 'id', ascending: false },
    limit: 1,
  });
  const maxId = normalizeId(headerRows[0]?.id);

  const nextId = maxId + 1;
  if (nextId < 1 || nextId > MAX_REIMBURSEMENT_ID) {
    throw new ServiceError('Reimbursement id exceeded allowed range 00000001-99999999');
  }
  return nextId;
}

function isDuplicateIdError(err: unknown): boolean {
  if (!(err instanceof ServiceError)) {
    return false;
  }
  const message = String(err.message ?? '').toLowerCase();
  return err.code === '23505' || message.includes('duplicate key');
}

function readProjectManagerUserId(project: ProjectRow): string | null {
  return readStringCandidate(project, [
    'projectmanager',
    'project_manager',
    'pm_userid',
    'manager',
    'managerid',
    'manager_id',
  ]);
}

function readInvoiceTravelId(invoice: InvoiceRecord): string | null {
  return readStringCandidate(invoice, ['travelid', 'travel_id']);
}

function readInvoiceProjectId(invoice: InvoiceRecord): string | null {
  return readStringCandidate(invoice, ['projectid', 'project_id', 'project']);
}

function readTravelProjectId(travel: Record<string, unknown>): string | null {
  return readStringCandidate(travel, ['projectid', 'project_id', 'project']);
}

function ensureInvoiceCanBeSubmitted(invoice: InvoiceRecord): void {
  const status = readInvoiceWorkflowStatus(invoice);
  if (status === 'SUBMITTED' || status === 'BOOKED') {
    throw new ServiceError(`Invoice ${invoice.invoiceno} already submitted/booked`);
  }
}

function readInvoiceDefaultReimbursementAmount(invoice: InvoiceRecord): string | undefined {
  const raw =
    invoice.grossamount ?? invoice.totalnetamount ?? invoice.totalnetamour ?? invoice.taxamount ?? '';
  return normalizeLineAmount(raw);
}

function readProjectChargeableDefault(
  project: ProjectRow,
  key: 'trchargeable' | 'txchargeable',
): boolean | undefined {
  return normalizeChargeableFlag(project[key]);
}

function normalizeLineInputs(input: CreateTravelReimbursementInput): ReimbursementLineInput[] {
  const normalized = new Map<string, ReimbursementLineInput>();

  for (const line of input.lines ?? []) {
    const invoiceNo = String(line.invoiceno ?? '').trim();
    if (!invoiceNo) {
      continue;
    }
    normalized.set(invoiceNo, {
      invoiceno: invoiceNo,
      tr_amount: normalizeLineAmount(line.tr_amount),
      trchargeable: normalizeChargeableFlag(line.trchargeable),
      txchargeable: normalizeChargeableFlag(line.txchargeable),
    });
  }

  for (const invoiceNoRaw of input.invoiceNos ?? []) {
    const invoiceNo = String(invoiceNoRaw ?? '').trim();
    if (!invoiceNo || normalized.has(invoiceNo)) {
      continue;
    }
    normalized.set(invoiceNo, { invoiceno: invoiceNo });
  }

  return Array.from(normalized.values());
}

async function prepareInvoices(
  lineInputs: ReimbursementLineInput[],
  targetProjectId: string,
  targetUserId: string,
  defaultTrChargeable?: boolean,
  defaultTxChargeable?: boolean,
): Promise<PreparedInvoice[]> {
  const prepared: PreparedInvoice[] = [];

  for (const lineInput of lineInputs) {
    const invoiceNo = lineInput.invoiceno;
    const invoice = await getInvoiceByNo(invoiceNo);
    if (!invoice) {
      throw new ServiceError(`Invoice ${invoiceNo} not found`);
    }

    ensureInvoiceCanBeSubmitted(invoice);

    const travelId = readInvoiceTravelId(invoice);
    if (travelId) {
      const travel = await requireTravelEntry(travelId);
      const invoiceProjectId = readTravelProjectId(travel);
      if (!invoiceProjectId) {
        throw new ServiceError(`TravelEntry ${travelId} has no projectid`);
      }

      if (invoiceProjectId !== targetProjectId) {
        throw new ServiceError(
          `Invoice ${invoiceNo} belongs to project ${invoiceProjectId}, expected ${targetProjectId}`,
        );
      }
    } else {
      const status = readInvoiceWorkflowStatus(invoice);
      if (status !== 'PENDING') {
        throw new ServiceError(`Invoice ${invoiceNo} has no travelid and status is not pending`);
      }
      const invoiceUser = readStringCandidate(invoice, ['userid', 'user_id', 'applicant']);
      if (!invoiceUser || invoiceUser.trim().toLowerCase() !== targetUserId.trim().toLowerCase()) {
        throw new ServiceError(`Invoice ${invoiceNo} has no travelid and does not belong to applicant`);
      }
      const invoiceProjectId = readInvoiceProjectId(invoice);
      if (invoiceProjectId && invoiceProjectId !== targetProjectId) {
        throw new ServiceError(
          `Invoice ${invoiceNo} belongs to project ${invoiceProjectId}, expected ${targetProjectId}`,
        );
      }
    }

    prepared.push({
      invoice,
      trAmount: normalizeLineAmount(lineInput.tr_amount) ?? readInvoiceDefaultReimbursementAmount(invoice),
      trChargeable: normalizeChargeableFlag(lineInput.trchargeable) ?? defaultTrChargeable,
      txChargeable: normalizeChargeableFlag(lineInput.txchargeable) ?? defaultTxChargeable,
    });
  }

  return prepared;
}

async function insertHeaderWithRetry(
  headerPayload: Record<string, unknown>,
  projectId: string,
  defaultApprover: string | null,
  userId: string,
  forceApproved: boolean,
): Promise<ReimbursementHeader> {
  let lastError: unknown;

  for (let i = 0; i < CREATE_ID_RETRY_LIMIT; i += 1) {
    const reimbursementId = await buildNextReimbursementId();
    try {
      console.log(`[TravelReimbursement] Attempting to insert header with id ${reimbursementId}`);
      const rows = await insertRows<ReimbursementHeader>(
        TABLES.reimbursementHeader,
        buildHeaderInsertPayload(
          headerPayload,
          reimbursementId,
          userId,
          projectId,
          defaultApprover,
          forceApproved,
        ),
      );
      if (rows[0]) {
        return rows[0];
      }
      throw new ServiceError('Failed to create reimbursement header');
    } catch (err) {
      console.error(`[TravelReimbursement] Insert failed for id ${reimbursementId}`, err);
      lastError = err;
      if (isDuplicateIdError(err)) {
        continue;
      }
      throw err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new ServiceError('Failed to create reimbursement header after retries');
}

export async function createTravelReimbursement(
  input: CreateTravelReimbursementInput,
): Promise<CreateTravelReimbursementResult> {
  const lineInputs = normalizeLineInputs(input);
  const invoiceNos = lineInputs.map((line) => line.invoiceno);

  if (invoiceNos.length === 0) {
    throw new ServiceError('reimbursement lines are empty');
  }

  const userId = readStringCandidate(input.header, ['userid', 'user_id', 'applicant']);
  if (!userId) {
    throw new ServiceError('header.userid is required. Create user first.');
  }
  await requireUser(userId);

  const projectId = readStringCandidate(input.header, ['projectid', 'project_id']);
  if (!projectId) {
    throw new ServiceError('header.projectid is required. Create project first.');
  }
  const project = await requireProject(projectId);
  const projectManager = readProjectManagerUserId(project);
  const defaultTrChargeable = readProjectChargeableDefault(project, 'trchargeable');
  const defaultTxChargeable = readProjectChargeableDefault(project, 'txchargeable');
  const autoApproved =
    !!projectManager &&
    projectManager.trim().toLowerCase() === userId.trim().toLowerCase();

  const preparedInvoices = await prepareInvoices(
    lineInputs,
    projectId,
    userId,
    defaultTrChargeable,
    defaultTxChargeable,
  );
  assertInvoiceSaveCurrencyConsistency(preparedInvoices.map((item) => item.invoice));

  const header = await insertHeaderWithRetry(
    input.header,
    projectId,
    projectManager,
    userId,
    autoApproved,
  );

  const lines: ReimbursementLine[] = [];
  const statusUpdatedInvoiceNos: string[] = [];
  try {
    for (const [index, item] of preparedInvoices.entries()) {
      const line = await insertLineWithFallback(
        header,
        item.invoice.invoiceno,
        item.trAmount,
        item.trChargeable,
        item.txChargeable,
        index + 1,
      );
      lines.push(line);
    }

    for (const item of preparedInvoices) {
      await setInvoiceStatus(item.invoice, 'submitted', userId);
      statusUpdatedInvoiceNos.push(item.invoice.invoiceno);
    }
  } catch (err) {
    for (const invoiceNo of statusUpdatedInvoiceNos) {
      const current = await getInvoiceByNo(invoiceNo);
      if (current) {
        await setInvoiceStatus(current, 'open').catch(() => undefined);
      }
    }

    await deleteLinesByHeader(header).catch(() => undefined);
    if (typeof header.id === 'number') {
      await deleteRows(TABLES.reimbursementHeader, { id: header.id }).catch(() => undefined);
    }

    throw err;
  }

  if (autoApproved) {
    // Self-approved reimbursements should not trigger any follow-up email on create.
    return { header, lines };
  }

  if (isHeaderApproved(header)) {
    try {
      // Direct email sending logic
      const trno = String(header.id ?? header.trno ?? '').trim();
      const invoiceNos = preparedInvoices.map((i) => i.invoice.invoiceno);
      await sendReimbursementEmail(trno, invoiceNos);
    } catch (error) {
      console.error('[TravelReimbursement] Approval email failed after create', {
        reimbursementId: header.id,
        trno: header.trno,
        message: error instanceof Error ? error.message : String(error),
        details:
          error instanceof ServiceError
            ? {
                status: error.status,
                code: error.code,
                details: error.details,
              }
            : undefined,
        error,
      });
      // Note: We swallow the email error so it doesn't fail the reimbursement creation
      // logic similar to previous implementation
    }
  } else {
    try {
      await sendReimbursementApprovalRequestEmail({
        id: header.id,
        trno: String(header.trno ?? header.id ?? '').trim(),
      });
    } catch (error) {
      console.error('[TravelReimbursement] Approval request email failed after create', {
        reimbursementId: header.id,
        trno: header.trno,
        message: error instanceof Error ? error.message : String(error),
        details:
          error instanceof ServiceError
            ? {
                status: error.status,
                code: error.code,
                details: error.details,
              }
            : undefined,
        error,
      });
      // Do not fail creation when email sending fails.
    }
  }

  return { header, lines };
}
