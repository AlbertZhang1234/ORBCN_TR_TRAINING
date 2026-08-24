import { ServiceError } from '../_core/error';
import { requireCustomer, requireUser, readStringCandidate } from '../_core/dependencies';
import { insertRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export interface ProjectRecord extends Record<string, unknown> {
  projectid: string;
  description: string;
  customerid?: string;
  paymentterm?: string;
  projectmanager?: string;
  salesperson?: string;
  trchargeable?: boolean;
  txchargeable?: boolean;
}

function buildCustomerKeyCandidates(
  payload: ProjectRecord,
  customerId: string,
): ProjectRecord[] {
  const candidates: ProjectRecord[] = [{ ...payload }];

  if (!Object.prototype.hasOwnProperty.call(payload, 'customer')) {
    const alt = { ...payload };
    delete alt.customerid;
    alt.customer = customerId;
    candidates.push(alt);
  }

  if (!Object.prototype.hasOwnProperty.call(payload, 'customerid')) {
    const alt = { ...payload };
    delete alt.customer;
    alt.customerid = customerId;
    candidates.push(alt);
  }

  return candidates;
}

export async function createProject(project: ProjectRecord): Promise<ProjectRecord> {
  if (!project.projectid?.trim()) {
    throw new ServiceError('projectid is required');
  }

  if (!project.description?.trim()) {
    throw new ServiceError('description is required');
  }

  const customerId = readStringCandidate(project, ['customerid', 'customer_id', 'customer']);
  if (!customerId) {
    throw new ServiceError('customerid is required. Create customer first.');
  }
  await requireCustomer(customerId);

  const projectManager = readStringCandidate(project, [
    'projectmanager',
    'project_manager',
    'pm_userid',
  ]);
  if (projectManager) {
    await requireUser(projectManager);
  }

  const salesperson = readStringCandidate(project, [
    'salesperson',
    'sales_person',
  ]);
  if (salesperson) {
    await requireUser(salesperson);
  }

  const candidates = buildCustomerKeyCandidates(project, customerId);
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const rows = await insertRows<ProjectRecord>(TABLES.project, candidate);
      if (rows[0]) {
        return rows[0];
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new ServiceError('createProject failed: no row returned');
}
