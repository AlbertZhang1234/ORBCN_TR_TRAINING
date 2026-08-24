import { query } from '../../lib/db';
import { ServiceError } from '../_core/error';
import {
  ensureRecordMutable,
  normalizeWorkflowStatus,
  readFirstExisting,
} from '../_core/locks';

type ApprovalStatusInput = 'approved' | 'rejected' | 'open' | 'wait for approval';

interface ReimbursementHeaderRow extends Record<string, unknown> {
  id?: number | string;
  trno?: string;
  projectid?: string;
  approvalstatus?: string;
  approval_status?: string;
}

interface ReimbursementLineRow extends Record<string, unknown> {
  id?: number | string;
  invoiceno?: string;
}

interface InvoiceRow extends Record<string, unknown> {
  invoiceno?: string;
  status?: string;
}

const APPROVAL_STATUS_CANDIDATES = ['approvalstatus', 'approval_status'];

export interface ServerApproveInput {
  reimbursementId?: number;
  reimbursementNo?: string;
  approvalStatus: ApprovalStatusInput;
  approver: string;
  approvedAt?: string;
}

function readHeaderId(header: ReimbursementHeaderRow): number {
  const raw = header.id;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  throw new ServiceError('Reimbursement id is invalid');
}

function readStringCandidate(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(row, key)) {
      continue;
    }
    const value = String(row[key] ?? '').trim();
    if (value) {
      return value;
    }
  }
  return null;
}

function normalizeApprovalStatus(
  status: ApprovalStatusInput,
): 'APPROVED' | 'REJECTED' | 'Wait for Approval' {
  const normalized = String(status).trim().toLowerCase();
  if (normalized === 'approved') {
    return 'APPROVED';
  }
  if (normalized === 'rejected') {
    return 'REJECTED';
  }
  return 'Wait for Approval';
}

function isHeaderApproved(header: ReimbursementHeaderRow): boolean {
  const raw = readFirstExisting(header, APPROVAL_STATUS_CANDIDATES);
  return normalizeWorkflowStatus(raw) === 'APPROVED';
}

async function getHeader(input: ServerApproveInput): Promise<ReimbursementHeaderRow> {
  if (typeof input.reimbursementId === 'number' && Number.isFinite(input.reimbursementId)) {
    const rows = await query<ReimbursementHeaderRow>(
      'SELECT * FROM "otto_tr_h" WHERE id = $1 LIMIT 1',
      [Math.trunc(input.reimbursementId)],
    );
    if (rows[0]) {
      return rows[0];
    }
  }

  const no = String(input.reimbursementNo ?? '').trim();
  if (no) {
    const rows = await query<ReimbursementHeaderRow>(
      'SELECT * FROM "otto_tr_h" WHERE trno = $1 LIMIT 1',
      [no],
    );
    if (rows[0]) {
      return rows[0];
    }
  }

  throw new ServiceError('Reimbursement not found');
}

async function listHeaderInvoiceNos(headerId: number): Promise<string[]> {
  const lineRows = await query<ReimbursementLineRow>(
    'SELECT id, invoiceno FROM "otto_tr_t" WHERE id = $1',
    [headerId],
  );
  const invoiceNos = Array.from(
    new Set(lineRows.map((row) => String(row.invoiceno ?? '').trim()).filter((x) => x.length > 0)),
  );
  if (invoiceNos.length === 0) {
    throw new ServiceError(`Reimbursement ${headerId} has no invoice lines`);
  }
  return invoiceNos;
}

async function assertApproverCanApproveHeader(
  approver: string,
  header: ReimbursementHeaderRow,
  headerId: number,
): Promise<void> {
  await listHeaderInvoiceNos(headerId);

  const projectId = readStringCandidate(header, ['projectid', 'project_id', 'project']);
  if (!projectId) {
    throw new ServiceError(`Reimbursement ${headerId} has no projectid`);
  }

  const projectRows = await query<Record<string, unknown>>(
    'SELECT * FROM "otto_project" WHERE projectid = $1 LIMIT 1',
    [projectId],
  );
  const project = projectRows[0];
  if (!project) {
    throw new ServiceError(`Project ${projectId} not found`);
  }

  const projectManager = readStringCandidate(project, [
    'projectmanager',
    'project_manager',
    'pm_userid',
    'manager',
    'managerid',
    'manager_id',
  ]);
  if (!projectManager) {
    throw new ServiceError(`Project ${projectId} has no project manager configured`);
  }
  if (projectManager.trim().toLowerCase() !== approver.trim().toLowerCase()) {
    throw new ServiceError(
      `Approver ${approver} is not the project manager of project ${projectId}`,
    );
  }
}

async function getInvoice(invoiceNo: string): Promise<InvoiceRow> {
  const rows = await query<InvoiceRow>(
    'SELECT * FROM "otto_invoices" WHERE invoiceno = $1 LIMIT 1',
    [invoiceNo],
  );
  const row = rows[0];
  if (!row) {
    throw new ServiceError(`Invoice ${invoiceNo} not found`);
  }
  return row;
}

async function setInvoiceStatus(invoiceNo: string, nextStatus: 'PENDING' | 'SUBMITTED'): Promise<void> {
  const rows = await query<InvoiceRow>(
    'UPDATE "otto_invoices" SET status = $2 WHERE invoiceno = $1 RETURNING invoiceno',
    [invoiceNo, nextStatus],
  );
  if (!rows[0]) {
    throw new ServiceError(`Invoice ${invoiceNo} status update failed`);
  }
}

async function reopenInvoicesForRejectedHeader(headerId: number): Promise<string[]> {
  const invoiceNos = await listHeaderInvoiceNos(headerId);
  const reopened: string[] = [];
  try {
    for (const invoiceNo of invoiceNos) {
      const invoice = await getInvoice(invoiceNo);
      ensureRecordMutable(invoice, `Invoice ${invoiceNo}`);
      await setInvoiceStatus(invoiceNo, 'PENDING');
      reopened.push(invoiceNo);
    }
  } catch (error) {
    for (const invoiceNo of reopened) {
      await setInvoiceStatus(invoiceNo, 'SUBMITTED').catch(() => undefined);
    }
    throw error;
  }
  return reopened;
}

function buildApprovalPatch(
  header: ReimbursementHeaderRow,
  status: 'APPROVED' | 'REJECTED' | 'Wait for Approval',
  approver: string,
  approvedAtIso: string,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(header, 'approvalstatus')) {
    patch.approvalstatus = status;
  } else if (Object.prototype.hasOwnProperty.call(header, 'approval_status')) {
    patch.approval_status = status;
  } else {
    patch.approvalstatus = status;
  }

  if (Object.prototype.hasOwnProperty.call(header, 'approver')) {
    patch.approver = approver;
  } else if (Object.prototype.hasOwnProperty.call(header, 'approvalby')) {
    patch.approvalby = approver;
  } else if (Object.prototype.hasOwnProperty.call(header, 'approvedby')) {
    patch.approvedby = approver;
  } else {
    patch.approver = approver;
  }

  if (Object.prototype.hasOwnProperty.call(header, 'approvedat')) {
    patch.approvedat = approvedAtIso;
  } else if (Object.prototype.hasOwnProperty.call(header, 'approved_at')) {
    patch.approved_at = approvedAtIso;
  } else if (Object.prototype.hasOwnProperty.call(header, 'approvalat')) {
    patch.approvalat = approvedAtIso;
  } else if (Object.prototype.hasOwnProperty.call(header, 'approval_at')) {
    patch.approval_at = approvedAtIso;
  }

  return patch;
}

async function updateHeaderById(
  headerId: number,
  patch: Record<string, unknown>,
): Promise<ReimbursementHeaderRow> {
  const entries = Object.entries(patch);
  if (entries.length === 0) {
    const rows = await query<ReimbursementHeaderRow>(
      'SELECT * FROM "otto_tr_h" WHERE id = $1 LIMIT 1',
      [headerId],
    );
    if (!rows[0]) {
      throw new ServiceError('Reimbursement not found after update');
    }
    return rows[0];
  }

  const params: unknown[] = [];
  const setSql = entries
    .map(([key, value], index) => {
      params.push(value);
      return `"${key}" = $${index + 1}`;
    })
    .join(', ');
  params.push(headerId);

  const rows = await query<ReimbursementHeaderRow>(
    `UPDATE "otto_tr_h" SET ${setSql} WHERE id = $${params.length} RETURNING *`,
    params,
  );
  if (!rows[0]) {
    throw new ServiceError('Failed to update reimbursement approval status');
  }
  return rows[0];
}

export interface ServerApproveResult {
  header: ReimbursementHeaderRow;
  wasApproved: boolean;
  nextStatus: 'APPROVED' | 'REJECTED' | 'Wait for Approval';
}

export async function approveTravelReimbursementOnServer(
  input: ServerApproveInput,
): Promise<ServerApproveResult> {
  const approver = String(input.approver ?? '').trim();
  if (!approver) {
    throw new ServiceError('approver is required for approve/reject');
  }

  const header = await getHeader(input);
  ensureRecordMutable(header, 'Reimbursement');
  const headerId = readHeaderId(header);
  const nextStatus = normalizeApprovalStatus(input.approvalStatus);
  const wasApproved = isHeaderApproved(header);
  const currentApprovalStatus = normalizeWorkflowStatus(
    readFirstExisting(header, APPROVAL_STATUS_CANDIDATES),
  );

  if (
    (nextStatus === 'APPROVED' || nextStatus === 'REJECTED') &&
    currentApprovalStatus !== 'WAIT FOR APPROVAL'
  ) {
    throw new ServiceError(
      `Reimbursement ${headerId} is already processed (current status: ${currentApprovalStatus})`,
      { status: 409 },
    );
  }

  if (nextStatus !== 'Wait for Approval') {
    await assertApproverCanApproveHeader(approver, header, headerId);
  }

  let reopenedInvoiceNos: string[] = [];
  if (nextStatus === 'REJECTED') {
    reopenedInvoiceNos = await reopenInvoicesForRejectedHeader(headerId);
  }

  const patch = buildApprovalPatch(
    header,
    nextStatus,
    approver,
    input.approvedAt ?? new Date().toISOString(),
  );

  let updated: ReimbursementHeaderRow;
  try {
    updated = await updateHeaderById(headerId, patch);
  } catch (error) {
    if (nextStatus === 'REJECTED') {
      for (const invoiceNo of reopenedInvoiceNos) {
        await setInvoiceStatus(invoiceNo, 'SUBMITTED').catch(() => undefined);
      }
    }
    throw error;
  }

  return {
    header: updated,
    wasApproved,
    nextStatus,
  };
}
