import { ServiceError } from './error';
import { selectOne } from './supabaseRest';
import { TABLES } from './tables';

type AnyRow = Record<string, unknown>;

export interface UserRow extends AnyRow {
  userid: string;
}

export interface CustomerRow extends AnyRow {
  customerid: string;
}

export interface ProjectRow extends AnyRow {
  projectid: string;
}

export interface TravelEntryRow extends AnyRow {
  travelid: string;
}

export async function requireUser(userId: string): Promise<UserRow> {
  const row = await selectOne<UserRow>(TABLES.user, { userid: userId });
  if (!row) {
    throw new ServiceError(`User ${userId} not found. Create user first.`);
  }
  return row;
}

export async function requireCustomer(customerId: string): Promise<CustomerRow> {
  const row = await selectOne<CustomerRow>(TABLES.customer, { customerid: customerId });
  if (!row) {
    throw new ServiceError(`Customer ${customerId} not found. Create customer first.`);
  }
  return row;
}

export async function requireProject(projectId: string): Promise<ProjectRow> {
  const row = await selectOne<ProjectRow>(TABLES.project, { projectid: projectId });
  if (!row) {
    throw new ServiceError(`Project ${projectId} not found. Create project first.`);
  }
  return row;
}

export async function requireTravelEntry(travelId: string): Promise<TravelEntryRow> {
  const row = await selectOne<TravelEntryRow>(TABLES.travelEntry, { travelid: travelId });
  if (!row) {
    throw new ServiceError(`TravelEntry ${travelId} not found. Create travel entry first.`);
  }
  return row;
}

export function readStringCandidate(
  obj: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}
