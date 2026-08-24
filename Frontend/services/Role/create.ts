import { ServiceError } from '../_core/error';
import { insertRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';
import type { RoleRecord } from './list';

export async function createRole(payload: RoleRecord): Promise<RoleRecord> {
  if (!payload.roleid?.trim()) {
    throw new ServiceError('roleid is required');
  }

  const rows = await insertRows<RoleRecord>(TABLES.role, payload);
  if (!rows[0]) {
    throw new ServiceError('createRole failed: no row returned');
  }

  return rows[0];
}
