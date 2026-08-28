import { ServiceError } from '../_core/error';
import { readStringCandidate, requireProject, requireTravelEntry } from '../_core/dependencies';
import { updateRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';
import {
  getInvoiceByNo,
  InvoiceRecord,
  readInvoiceWorkflowStatus,
  setInvoiceStatus,
} from '../Invoice/_shared';
import {
  assertHeaderMutable,
  deleteLinesByHeader,
  getHeaderFilter,
  getLineRowsByHeader,
  getReimbursementHeader,
  insertLineWithFallback,
  ReimbursementFilter,
  ReimbursementHeader,
  ReimbursementLine,
  ReimbursementLineInput,
  normalizeChargeableFlag,
  normalizeLineAmount,
  assertInvoiceSaveCurrencyConsistency,
} from './_shared';

export interface ChangeTravelReimbursementInput {
  filter: ReimbursementFilter;
  headerPatch?: Record<string, unknown>;
  invoiceNos?: string[];
  lines?: ReimbursementLineInput[];
}

export interface ChangeTravelReimbursementResult {
  header: ReimbursementHeader;
  lines: ReimbursementLine[];
}

interface ValidatedInvoice {
  invoice: InvoiceRecord;
  isExistingLine: boolean;
  requestedTrAmount?: string;
  requestedTrChargeable?: boolean;
  requestedTxChargeable?: boolean;
}

function buildHeaderPatch(
  patch: Record<string, unknown>,
  current: ReimbursementHeader,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};

  const userId = readStringCandidate(patch, ['userid', 'user_id', 'applicant']);
  if (userId) {
    next.userid = userId;
  }

  const projectId = readStringCandidate(patch, ['projectid', 'project_id', 'project']);
  if (projectId) {
    next.projectid = projectId;
  }

  const approver = readStringCandidate(patch, ['approver', 'approvalby', 'approvedby']);
  if (approver) {
    if (Object.prototype.hasOwnProperty.call(current, 'approver')) {
      next.approver = approver;
    } else if (Object.prototype.hasOwnProperty.call(current, 'approvalby')) {
      next.approvalby = approver;
    } else if (Object.prototype.hasOwnProperty.call(current, 'approvedby')) {
      next.approvedby = approver;
    } else {
      next.approver = approver;
    }
  }

  return next;
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

async function inferProjectIdFromInvoice(invoiceNo: string): Promise<string | null> {
  const invoice = await getInvoiceByNo(invoiceNo);
  if (!invoice) {
    return null;
  }
  const travelId = readInvoiceTravelId(invoice);
  if (!travelId) {
    return readInvoiceProjectId(invoice);
  }
  const travel = await requireTravelEntry(travelId);
  return readTravelProjectId(travel);
}

function readInvoiceDefaultReimbursementAmount(invoice: InvoiceRecord): string | undefined {
  const raw =
    invoice.grossamount ?? invoice.totalnetamount ?? invoice.totalnetamour ?? invoice.taxamount ?? '';
  return normalizeLineAmount(raw);
}

function normalizeLineInputs(input: ChangeTravelReimbursementInput): ReimbursementLineInput[] {
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

async function validateInvoicesForChange(
  lineInputs: ReimbursementLineInput[],
  oldInvoiceSet: Set<string>,
  targetProjectId: string,
  targetUserId: string,
): Promise<ValidatedInvoice[]> {
  const result: ValidatedInvoice[] = [];
  for (const lineInput of lineInputs) {
    const invoiceNo = lineInput.invoiceno;
    const invoice = await getInvoiceByNo(invoiceNo);
    if (!invoice) {
      throw new ServiceError(`Invoice ${invoiceNo} not found`);
    }

    const isExistingLine = oldInvoiceSet.has(invoiceNo);
    const status = readInvoiceWorkflowStatus(invoice);
    if (!isExistingLine && (status === 'SUBMITTED' || status === 'BOOKED')) {
      throw new ServiceError(`Invoice ${invoiceNo} already submitted/booked`);
    }

    const travelId = readInvoiceTravelId(invoice);
    if (travelId) {
      const travel = await requireTravelEntry(travelId);
      const projectId = readTravelProjectId(travel);
      if (!projectId) {
        throw new ServiceError(`TravelEntry ${travelId} has no projectid`);
      }
      if (projectId !== targetProjectId) {
        throw new ServiceError(
          `Invoice ${invoiceNo} belongs to project ${projectId}, expected ${targetProjectId}`,
        );
      }
    } else {
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

    result.push({
      invoice,
      isExistingLine,
      requestedTrAmount: normalizeLineAmount(lineInput.tr_amount),
      requestedTrChargeable: normalizeChargeableFlag(lineInput.trchargeable),
      requestedTxChargeable: normalizeChargeableFlag(lineInput.txchargeable),
    });
  }
  return result;
}

export async function changeTravelReimbursement(
  input: ChangeTravelReimbursementInput,
): Promise<ChangeTravelReimbursementResult> {
  const header = await getReimbursementHeader(input.filter);
  if (!header) {
    throw new ServiceError('Reimbursement not found');
  }

  assertHeaderMutable(header);

  let nextHeader = header;
  if (input.headerPatch && Object.keys(input.headerPatch).length > 0) {
    const patch = buildHeaderPatch(input.headerPatch, header);
    if (Object.keys(patch).length > 0) {
      const updated = await updateRows<ReimbursementHeader>(
        TABLES.reimbursementHeader,
        getHeaderFilter(input.filter),
        patch,
      );

      if (!updated[0]) {
        throw new ServiceError('Failed to update reimbursement header');
      }
      nextHeader = updated[0];
    }
  }

  const oldLineRows = await getLineRowsByHeader(nextHeader);
  if (!input.invoiceNos && !input.lines) {
    return {
      header: nextHeader,
      lines: oldLineRows,
    };
  }

  const lineInputs = normalizeLineInputs(input);
  const nextInvoiceNos = lineInputs.map((line) => line.invoiceno);
  if (nextInvoiceNos.length === 0) {
    throw new ServiceError('reimbursement lines are empty');
  }

  const oldInvoiceNos = oldLineRows.map((line) => line.invoiceno);
  const oldLineAmountMap = new Map(
    oldLineRows.map((line) => [line.invoiceno, normalizeLineAmount(line.tr_amount)] as const),
  );
  const oldTrChargeableMap = new Map(
    oldLineRows.map((line) => [line.invoiceno, normalizeChargeableFlag(line.trchargeable)] as const),
  );
  const oldTxChargeableMap = new Map(
    oldLineRows.map((line) => [line.invoiceno, normalizeChargeableFlag(line.txchargeable)] as const),
  );
  const oldInvoiceSet = new Set(oldInvoiceNos);
  const targetProjectIdFromPatch = input.headerPatch
    ? readStringCandidate(input.headerPatch, ['projectid', 'project_id'])
    : null;
  const targetProjectId =
    targetProjectIdFromPatch ??
    (oldInvoiceNos[0] ? await inferProjectIdFromInvoice(oldInvoiceNos[0]) : null);
  if (!targetProjectId) {
    throw new ServiceError('projectid is required when changing reimbursement invoices');
  }

  const targetUserId =
    readStringCandidate(input.headerPatch ?? {}, ['userid', 'user_id', 'applicant']) ??
    readStringCandidate(nextHeader, ['userid', 'user_id', 'applicant']);
  if (!targetUserId) {
    throw new ServiceError('userid is required when changing reimbursement invoices');
  }
  const targetProject = await requireProject(targetProjectId);
  const defaultTrChargeable = normalizeChargeableFlag(targetProject.trchargeable);
  const defaultTxChargeable = normalizeChargeableFlag(targetProject.txchargeable);

  const validated = await validateInvoicesForChange(
    lineInputs,
    oldInvoiceSet,
    targetProjectId,
    targetUserId,
  );
  assertInvoiceSaveCurrencyConsistency(validated.map((item) => item.invoice));
  const addedInvoices = validated.filter((x) => !x.isExistingLine).map((x) => x.invoice);
  const removedInvoiceNos = oldInvoiceNos.filter((no) => !nextInvoiceNos.includes(no));
  const openedInvoiceNos: string[] = [];

  for (const invoice of addedInvoices) {
    await setInvoiceStatus(invoice, 'submitted');
  }

  try {
    await deleteLinesByHeader(nextHeader);

    const newLines: ReimbursementLine[] = [];
    for (const [index, item] of validated.entries()) {
      const trAmount =
        item.requestedTrAmount ??
        oldLineAmountMap.get(item.invoice.invoiceno) ??
        readInvoiceDefaultReimbursementAmount(item.invoice);
      const trChargeable =
        item.requestedTrChargeable ??
        oldTrChargeableMap.get(item.invoice.invoiceno) ??
        defaultTrChargeable;
      const txChargeable =
        item.requestedTxChargeable ??
        oldTxChargeableMap.get(item.invoice.invoiceno) ??
        defaultTxChargeable;
      const line = await insertLineWithFallback(
        nextHeader,
        item.invoice.invoiceno,
        trAmount,
        trChargeable,
        txChargeable,
        index + 1,
      );
      newLines.push(line);
    }

    for (const invoiceNo of removedInvoiceNos) {
      const invoice = await getInvoiceByNo(invoiceNo);
      if (invoice) {
        await setInvoiceStatus(invoice, 'open');
        openedInvoiceNos.push(invoiceNo);
      }
    }

    return {
      header: nextHeader,
      lines: newLines,
    };
  } catch (err) {
    await deleteLinesByHeader(nextHeader).catch(() => undefined);
    for (const oldLine of oldLineRows) {
      await insertLineWithFallback(
        nextHeader,
        oldLine.invoiceno,
        oldLine.tr_amount,
        oldLine.trchargeable,
        oldLine.txchargeable,
        oldLine.seqno,
      ).catch(() => undefined);
    }

    for (const invoice of addedInvoices) {
      const current = await getInvoiceByNo(invoice.invoiceno);
      if (current) {
        await setInvoiceStatus(current, 'open').catch(() => undefined);
      }
    }
    for (const invoiceNo of openedInvoiceNos) {
      const current = await getInvoiceByNo(invoiceNo);
      if (current) {
        await setInvoiceStatus(current, 'submitted').catch(() => undefined);
      }
    }
    throw err;
  }
}
