import { ServiceError } from '../_core/error';
import { ensureRecordMutable } from '../_core/locks';
import { requireProject, readStringCandidate } from '../_core/dependencies';
import { normalizeWorkflowStatus, readFirstExisting } from '../_core/locks';
import { selectRows, updateRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';
import { getClientSessionId } from '../_core/session';
import { ensureInvoiceMutable, getInvoiceByNo, setInvoiceStatus } from '../Invoice/_shared';

import {
  getHeaderFilter,
  getReimbursementHeader,
  ReimbursementFilter,
  ReimbursementHeader,
} from './_shared';

export interface ApproveTravelReimbursementInput {
  filter: ReimbursementFilter;
  approvalStatus: 'approved' | 'rejected' | 'open' | 'wait for approval';
  approver?: string;
  approvedAt?: string;
  rejectionComment?: string;
}

interface ReimbursementLineRow extends Record<string, unknown> {
  id?: number;
  invoiceno?: string;
}

interface PreparedRejectionInvoice {
  invoiceNo: string;
}

const APPROVAL_STATUS_CANDIDATES = ['approvalstatus', 'approval_status'];

function normalizeApprovalStatus(
  status: ApproveTravelReimbursementInput['approvalStatus'],
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

function isHeaderApproved(header: ReimbursementHeader): boolean {
  const raw = readFirstExisting(header, APPROVAL_STATUS_CANDIDATES);
  return normalizeWorkflowStatus(raw) === 'APPROVED';
}

function readHeaderId(header: ReimbursementHeader, filter: ReimbursementFilter): number | null {
  if (typeof header.id === 'number' && Number.isFinite(header.id)) {
    return header.id;
  }
  if (typeof filter.id === 'number' && Number.isFinite(filter.id)) {
    return filter.id;
  }
  return null;
}

async function assertApproverCanApproveHeader(
  approver: string,
  header: ReimbursementHeader,
  headerId: number,
): Promise<void> {
  const lineRows = await selectRows<ReimbursementLineRow>(TABLES.reimbursementLine, {
    select: 'id,invoiceno',
    filters: { id: headerId },
  });
  const invoiceNos = Array.from(
    new Set(lineRows.map((row) => String(row.invoiceno ?? '').trim()).filter((x) => x.length > 0)),
  );
  if (invoiceNos.length === 0) {
    throw new ServiceError(`Reimbursement ${headerId} has no invoice lines`);
  }

  const projectId = readStringCandidate(header, ['projectid', 'project_id', 'project']);
  if (!projectId) {
    throw new ServiceError(`Reimbursement ${headerId} has no projectid`);
  }

  // New rule: reimbursement header owns the project relation (1:1). Invoice travelid is optional.
  // Keep invoice existence check only.
  for (const invoiceNo of invoiceNos) {
    const invoice = await getInvoiceByNo(invoiceNo);
    if (!invoice) {
      throw new ServiceError(`Invoice ${invoiceNo} not found`);
    }
  }

  const project = await requireProject(projectId);
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

async function listHeaderInvoiceNos(headerId: number): Promise<string[]> {
  const lineRows = await selectRows<ReimbursementLineRow>(TABLES.reimbursementLine, {
    select: 'id,invoiceno',
    filters: { id: headerId },
  });

  return Array.from(
    new Set(lineRows.map((row) => String(row.invoiceno ?? '').trim()).filter((x) => x.length > 0)),
  );
}

async function prepareInvoicesForRejection(headerId: number): Promise<PreparedRejectionInvoice[]> {
  const invoiceNos = await listHeaderInvoiceNos(headerId);
  if (invoiceNos.length === 0) {
    throw new ServiceError(`Reimbursement ${headerId} has no invoice lines`);
  }

  const prepared: PreparedRejectionInvoice[] = [];
  for (const invoiceNo of invoiceNos) {
    const invoice = await getInvoiceByNo(invoiceNo);
    if (!invoice) {
      throw new ServiceError(`Invoice ${invoiceNo} not found`);
    }

    ensureInvoiceMutable(invoice);
    prepared.push({ invoiceNo });
  }

  return prepared;
}

async function reopenInvoicesForRejectedHeader(headerId: number): Promise<string[]> {
  const prepared = await prepareInvoicesForRejection(headerId);
  const reopenedInvoiceNos: string[] = [];

  try {
    for (const item of prepared) {
      const current = await getInvoiceByNo(item.invoiceNo);
      if (!current) {
        throw new ServiceError(`Invoice ${item.invoiceNo} not found`);
      }

      await setInvoiceStatus(current, 'open');
      reopenedInvoiceNos.push(item.invoiceNo);
    }
  } catch (error) {
    for (const invoiceNo of reopenedInvoiceNos) {
      const current = await getInvoiceByNo(invoiceNo);
      if (current) {
        await setInvoiceStatus(current, 'submitted').catch(() => undefined);
      }
    }
    throw error;
  }

  return reopenedInvoiceNos;
}

async function rollbackSubmittedInvoices(invoiceNos: string[]): Promise<void> {
  for (const invoiceNo of invoiceNos) {
    const current = await getInvoiceByNo(invoiceNo);
    if (current) {
      await setInvoiceStatus(current, 'submitted').catch(() => undefined);
    }
  }
}

function buildApprovalPatch(
  header: ReimbursementHeader,
  input: ApproveTravelReimbursementInput,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const status = normalizeApprovalStatus(input.approvalStatus);

  if (Object.prototype.hasOwnProperty.call(header, 'approvalstatus')) {
    patch.approvalstatus = status;
  } else if (Object.prototype.hasOwnProperty.call(header, 'approval_status')) {
    patch.approval_status = status;
  } else {
    patch.approvalstatus = status;
  }

  if (input.approver) {
    if (Object.prototype.hasOwnProperty.call(header, 'approver')) {
      patch.approver = input.approver;
    } else if (Object.prototype.hasOwnProperty.call(header, 'approvalby')) {
      patch.approvalby = input.approver;
    } else if (Object.prototype.hasOwnProperty.call(header, 'approvedby')) {
      patch.approvedby = input.approver;
    }
  }

  const atIso = input.approvedAt ?? new Date().toISOString();
  if (Object.prototype.hasOwnProperty.call(header, 'approvedat')) {
    patch.approvedat = atIso;
  } else if (Object.prototype.hasOwnProperty.call(header, 'approved_at')) {
    patch.approved_at = atIso;
  } else if (Object.prototype.hasOwnProperty.call(header, 'approvalat')) {
    patch.approvalat = atIso;
  } else if (Object.prototype.hasOwnProperty.call(header, 'approval_at')) {
    patch.approval_at = atIso;
  }

  return patch;
}

export async function sendReimbursementEmail(trno: string, invoiceNos: string[]) {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = String(trno ?? '').trim();
  if (!normalized) {
    throw new ServiceError('reimbursement id/no is required for finance notification');
  }

  const asNumber = Number(normalized);
  const payload =
    Number.isFinite(asNumber) && asNumber > 0
      ? { reimbursementId: Math.trunc(asNumber) }
      : { reimbursementNo: normalized };

  const response = await fetch('/api/reimbursement/sendtofinance', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': getClientSessionId(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = 'Failed to send reimbursement notification email';
    try {
      const body = (await response.json()) as {
        message?: string;
        error?: string;
        step?: string;
        requestId?: string;
      };
      message = String(body.error ?? body.message ?? message);
      if (body.step) {
        message += ` (step: ${body.step})`;
      }
      if (body.requestId) {
        message += ` [${body.requestId}]`;
      }
    } catch {
      // keep default message
    }
    throw new ServiceError(message, { status: response.status });
  }

  if (invoiceNos.length === 0) {
    console.warn('[TravelReimbursement] sendReimbursementEmail called with empty invoiceNos', {
      reimbursement: normalized,
    });
  }
}

export async function sendReimbursementApprovalRequestEmail(
  reimbursement: { id?: number | string; trno?: string },
): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  const idRaw = reimbursement.id;
  const id =
    typeof idRaw === 'number'
      ? idRaw
      : typeof idRaw === 'string'
        ? Number(idRaw)
        : NaN;
  const trno = String(reimbursement.trno ?? '').trim();

  const payload =
    Number.isFinite(id) && id > 0
      ? { reimbursementId: Math.trunc(id) }
      : trno
        ? { reimbursementNo: trno }
        : null;

  if (!payload) {
    throw new ServiceError('reimbursement id/no is required for approver notification');
  }

  const response = await fetch('/api/reimbursement/sendtoapprover', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': getClientSessionId(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = 'Failed to send approval notification email';
    try {
      const body = (await response.json()) as {
        message?: string;
        error?: string;
      };
      message = String(body.error ?? body.message ?? message);
    } catch {
      // keep default message
    }
    throw new ServiceError(message, { status: response.status });
  }
}

export async function approveTravelReimbursement(
  input: ApproveTravelReimbursementInput,
): Promise<ReimbursementHeader> {
  if (typeof window === 'undefined') {
    throw new ServiceError('approveTravelReimbursement is browser-only');
  }

  const reimbursementId =
    typeof input.filter.id === 'number' && Number.isFinite(input.filter.id)
      ? Math.trunc(input.filter.id)
      : undefined;
  const reimbursementNo = String(input.filter.trno ?? '').trim() || undefined;
  if (!reimbursementId && !reimbursementNo) {
    throw new ServiceError('Reimbursement id or trno is required');
  }

  const response = await fetch('/api/reimbursement/approve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': getClientSessionId(),
    },
    body: JSON.stringify({
      reimbursementId,
      reimbursementNo,
      approvalStatus: input.approvalStatus,
      approver: input.approver,
      approvedAt: input.approvedAt,
      rejectionComment: input.rejectionComment,
    }),
  });

  if (!response.ok) {
    let message = 'Failed to update reimbursement approval status';
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      message = String(body.error ?? body.message ?? message);
    } catch {
      // keep default
    }
    throw new ServiceError(message, { status: response.status });
  }

  const payload = (await response.json()) as { header?: ReimbursementHeader };
  if (!payload.header) {
    throw new ServiceError('Approval response missing header');
  }
  return payload.header;
}
