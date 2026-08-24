import { ServiceError } from '../_core/error';
import { updateRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';
import type { RoleRecord } from './list';

export async function changeRole(
  roleId: string,
  patch: Record<string, unknown>,
): Promise<RoleRecord> {
  if (!roleId?.trim()) {
    throw new ServiceError('roleId is required');
  }

  if (!patch || Object.keys(patch).length === 0) {
    throw new ServiceError('patch is empty');
  }

  const rows = await updateRows<RoleRecord>(TABLES.role, { roleid: roleId }, patch);
  if (!rows[0]) {
    throw new ServiceError(`changeRole failed: role ${roleId} not found`);
  }

  return rows[0];
}
