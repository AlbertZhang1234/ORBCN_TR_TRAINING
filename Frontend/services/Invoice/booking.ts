import { ServiceError } from '../_core/error';
import {
  buildStatusPatch,
  ensureRecordMutable,
  normalizeWorkflowStatus,
  readFirstExisting,
  STATUS_CANDIDATES,
} from '../_core/locks';
import { selectOne, selectRows, updateRows } from '../_core/supabaseRest';
import { derivePermissionFlags } from '../_core/roles';
import { TABLES } from '../_core/tables';
import { getInvoiceByNo, InvoiceRecord } from './_shared';

export interface InvoiceBookingInput {
  invoiceNos: string[];
  reimbursementId?: number;
  reimbursementNo?: string;
  bookedBy?: string;
  bookedAt?: string;
}

interface ReimbursementHeader extends Record<string, unknown> {
  id?: number;
  trno?: string;
}

const APPROVAL_STATUS_CANDIDATES = ['approvalstatus', 'approval_status'];
interface UserRoleRow extends Record<string, unknown> {
  roleid?: string;
}

function isApprovalApproved(header: ReimbursementHeader): boolean {
  const raw = readFirstExisting(header, APPROVAL_STATUS_CANDIDATES);
  return normalizeWorkflowStatus(raw) === 'APPROVED';
}

/*
async function assertBookedByFinance(bookedBy?: string): Promise<void> {
  const userid = String(bookedBy ?? '').trim();
  if (!userid) {
    throw new ServiceError('bookedBy is required');
  }

  const rows = await selectRows<UserRoleRow>(TABLES.userRole, {
    select: 'roleid',
    filters: { userid },
  });
  const roleids = Array.from(
    new Set(rows.map((row) => String(row.roleid ?? '').trim()).filter((x) => x.length > 0)),
  );
  const flags = derivePermissionFlags(roleids);
  if (!flags.isFinance) {
    throw new ServiceError('Only finance manager can perform booking');
  }
}
*/

async function getReimbursementHeader(
  input: InvoiceBookingInput,
): Promise<ReimbursementHeader | null> {
  if (typeof input.reimbursementId === 'number') {
    return selectOne<ReimbursementHeader>(TABLES.reimbursementHeader, {
      id: input.reimbursementId,
    });
  }

  if (input.reimbursementNo?.trim()) {
    return selectOne<ReimbursementHeader>(TABLES.reimbursementHeader, {
      trno: input.reimbursementNo,
    });
  }

  return null;
}

async function markReimbursementBooked(
  header: ReimbursementHeader,
  actor?: string,
  atIso?: string,
): Promise<ReimbursementHeader> {
  const patch = buildStatusPatch(header, 'booked', actor, atIso);
  if (Object.keys(patch).length === 0) {
    throw new ServiceError(
      `Reimbursement has no supported status field (expected one of: ${STATUS_CANDIDATES.join(', ')})`,
    );
  }

  const filters =
    typeof header.id === 'number' ? { id: header.id } : { trno: String(header.trno ?? '') };

  const rows = await updateRows<ReimbursementHeader>(TABLES.reimbursementHeader, filters, patch);
  if (!rows[0]) {
    throw new ServiceError('Failed to update reimbursement booking status');
  }

  return rows[0];
}

async function markInvoiceBooked(
  invoice: InvoiceRecord,
  actor?: string,
  atIso?: string,
): Promise<InvoiceRecord> {
  const patch = buildStatusPatch(invoice, 'booked', actor, atIso);
  if (Object.keys(patch).length === 0) {
    throw new ServiceError(
      `Invoice ${invoice.invoiceno} has no supported status field (expected one of: ${STATUS_CANDIDATES.join(', ')})`,
    );
  }

  const rows = await updateRows<InvoiceRecord>(TABLES.invoice, { invoiceno: invoice.invoiceno }, patch);
  if (!rows[0]) {
    throw new ServiceError(`Failed to mark invoice ${invoice.invoiceno} as booked`);
  }

  return rows[0];
}

export async function bookingInvoices(input: InvoiceBookingInput): Promise<{
  invoices: InvoiceRecord[];
  reimbursement?: ReimbursementHeader;
}> {
  // await assertBookedByFinance(input.bookedBy);

  const invoiceNos = Array.from(
    new Set(input.invoiceNos.map((x) => x.trim()).filter((x) => x.length > 0)),
  );

  if (invoiceNos.length === 0) {
    throw new ServiceError('invoiceNos is empty');
  }

  const header = await getReimbursementHeader(input);
  if (!header) {
    throw new ServiceError('reimbursementId or reimbursementNo is required for booking');
  }

  // ensureRecordMutable(header, 'Reimbursement');
  if (!isApprovalApproved(header)) {
    throw new ServiceError('Reimbursement must be APPROVED before booking');
  }

  const atIso = input.bookedAt ?? new Date().toISOString();

  const updatedInvoices: InvoiceRecord[] = [];
  for (const invoiceNo of invoiceNos) {
    const invoice = await getInvoiceByNo(invoiceNo);
    if (!invoice) {
      throw new ServiceError(`Invoice ${invoiceNo} not found`);
    }

    // ensureRecordMutable(invoice, `Invoice ${invoiceNo}`);
    const next = await markInvoiceBooked(invoice, input.bookedBy, atIso);
    updatedInvoices.push(next);
  }

  const updatedHeader = await markReimbursementBooked(header, input.bookedBy, atIso);

  return {
    invoices: updatedInvoices,
    reimbursement: updatedHeader,
  };
}
