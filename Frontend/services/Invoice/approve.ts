import { ServiceError } from '../_core/error';
import { requireProject, requireTravelEntry, readStringCandidate } from '../_core/dependencies';
import { selectRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';
import { approveTravelReimbursement } from '../TravelReimbursement/approve';
import { getInvoiceByNo, readInvoiceWorkflowStatus, type InvoiceRecord } from './_shared';

interface ReimbursementLineRow extends Record<string, unknown> {
  id: number;
  invoiceno: string;
}

export interface ApproveInvoicesInput {
  invoiceNos: string[];
  approver: string;
  approvedAt?: string;
}

export interface ApproveInvoicesResult {
  reimbursementIds: number[];
  invoiceNos: string[];
}

async function resolveReimbursementIdByInvoiceNo(invoiceNo: string): Promise<number> {
  const rows = await selectRows<ReimbursementLineRow>(TABLES.reimbursementLine, {
    select: 'id,invoiceno',
    filters: { invoiceno: invoiceNo },
  });

  const ids = Array.from(
    new Set(
      rows
        .map((row) => row.id)
        .filter((id): id is number => typeof id === 'number' && Number.isFinite(id)),
    ),
  );

  if (ids.length === 0) {
    throw new ServiceError(`Invoice ${invoiceNo} is not attached to any reimbursement`);
  }
  if (ids.length > 1) {
    throw new ServiceError(`Invoice ${invoiceNo} is attached to multiple reimbursements`);
  }
  return ids[0];
}

function assertInvoiceSubmittableForApproval(invoice: InvoiceRecord): void {
  const status = readInvoiceWorkflowStatus(invoice);
  if (status === 'BOOKED') {
    throw new ServiceError(`Invoice ${invoice.invoiceno} is already BOOKED`);
  }
  if (status === 'PENDING') {
    throw new ServiceError(`Invoice ${invoice.invoiceno} is still PENDING and cannot be approved`);
  }
}

async function assertApproverCanApproveInvoice(
  approver: string,
  invoice: InvoiceRecord,
): Promise<void> {
  const travelId = readStringCandidate(invoice, ['travelid', 'travel_id']);
  if (!travelId) {
    throw new ServiceError(`Invoice ${invoice.invoiceno} has no travelid`);
  }
  const travel = await requireTravelEntry(travelId);
  const projectId = readStringCandidate(travel, ['projectid', 'project_id', 'project']);
  if (!projectId) {
    throw new ServiceError(`TravelEntry ${travelId} has no projectid`);
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
  if (projectManager !== approver) {
    throw new ServiceError(
      `Approver ${approver} is not the project manager of project ${projectId}`,
    );
  }
}

export async function approveInvoices(
  input: ApproveInvoicesInput,
): Promise<ApproveInvoicesResult> {
  const approver = String(input.approver ?? '').trim();
  if (!approver) {
    throw new ServiceError('approver is required');
  }

  const invoiceNos = Array.from(
    new Set(input.invoiceNos.map((x) => x.trim()).filter((x) => x.length > 0)),
  );
  if (invoiceNos.length === 0) {
    throw new ServiceError('invoiceNos is empty');
  }

  for (const invoiceNo of invoiceNos) {
    const invoice = await getInvoiceByNo(invoiceNo);
    if (!invoice) {
      throw new ServiceError(`Invoice ${invoiceNo} not found`);
    }
    assertInvoiceSubmittableForApproval(invoice);
    await assertApproverCanApproveInvoice(approver, invoice);
  }

  const reimbursementIds: number[] = [];
  for (const invoiceNo of invoiceNos) {
    const reimbursementId = await resolveReimbursementIdByInvoiceNo(invoiceNo);
    if (!reimbursementIds.includes(reimbursementId)) {
      reimbursementIds.push(reimbursementId);
    }
  }

  for (const reimbursementId of reimbursementIds) {
    await approveTravelReimbursement({
      filter: { id: reimbursementId },
      approvalStatus: 'approved',
      approver,
      approvedAt: input.approvedAt,
    });
  }

  return {
    reimbursementIds,
    invoiceNos,
  };
}
