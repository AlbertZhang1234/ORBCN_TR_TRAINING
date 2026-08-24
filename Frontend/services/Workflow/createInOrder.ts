import { createCustomer, CustomerRecord } from '../Customer/create';
import { saveInvoice } from '../Invoice/save';
import { createProject, ProjectRecord } from '../Projects/create';
import { createTravelEntry, TravelEntryRecord } from '../TravelEntry/create';
import {
  createTravelReimbursement,
  CreateTravelReimbursementResult,
} from '../TravelReimbursement/create';
import { createUser, UserRecord } from '../User/create';
import type { InvoiceRecord } from '../Invoice/_shared';

export interface OrderedCreationInput {
  user: UserRecord;
  customer: CustomerRecord;
  project: ProjectRecord;
  travelEntry: Record<string, unknown> & {
    travelid: string;
    userid?: string;
    projectid?: string;
  };
  invoices: Array<Record<string, unknown> & { invoiceno: string }>;
  reimbursement: {
    header: Record<string, unknown>;
    invoiceNos?: string[];
  };
}

export interface OrderedCreationResult {
  user: UserRecord;
  customer: CustomerRecord;
  project: ProjectRecord;
  travelEntry: TravelEntryRecord;
  invoices: Array<Record<string, unknown>>;
  reimbursement: CreateTravelReimbursementResult;
}

export async function createInRequiredOrder(
  input: OrderedCreationInput,
): Promise<OrderedCreationResult> {
  const user = await createUser(input.user);
  const customer = await createCustomer(input.customer);

  const projectPayload: ProjectRecord = {
    ...input.project,
  };
  if (!projectPayload.customerid && !projectPayload.customer) {
    projectPayload.customerid = customer.customerid;
  }
  const project = await createProject(projectPayload);

  const travelPayload: TravelEntryRecord = {
    ...input.travelEntry,
    userid: input.travelEntry.userid || user.userid,
    projectid: input.travelEntry.projectid || project.projectid,
  };
  const travelEntry = await createTravelEntry(travelPayload);

  const invoices: Array<Record<string, unknown>> = [];
  for (const invoicePayload of input.invoices) {
    const payloadUserId = invoicePayload['userid'];
    const payloadTravelId = invoicePayload['travelid'];

    const normalizedInvoice: InvoiceRecord = {
      ...invoicePayload,
      userid: typeof payloadUserId === 'string' && payloadUserId.trim() ? payloadUserId : user.userid,
      travelid:
        typeof payloadTravelId === 'string' && payloadTravelId.trim()
          ? payloadTravelId
          : travelEntry.travelid,
      invoiceno: String(invoicePayload.invoiceno),
    };
    const invoice = await saveInvoice(normalizedInvoice);
    invoices.push(invoice);
  }

  const header = {
    ...input.reimbursement.header,
    userid: input.reimbursement.header['userid'] ?? user.userid,
    projectid: input.reimbursement.header['projectid'] ?? project.projectid,
    travelid: input.reimbursement.header['travelid'] ?? travelEntry.travelid,
  };

  const reimbursement = await createTravelReimbursement({
    header,
    invoiceNos:
      input.reimbursement.invoiceNos ??
      invoices
        .map((row) => String(row.invoiceno ?? ''))
        .filter((no) => no.length > 0),
  });

  return {
    user,
    customer,
    project,
    travelEntry,
    invoices,
    reimbursement,
  };
}
