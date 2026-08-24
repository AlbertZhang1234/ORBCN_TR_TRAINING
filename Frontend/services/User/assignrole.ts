import { ServiceError } from '../_core/error';
import { insertRows, selectRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export interface UserRoleRecord {
  userid: string;
  roleid: string;
}

export async function assignRole(payload: UserRoleRecord): Promise<UserRoleRecord> {
  if (!payload.userid?.trim()) {
    throw new ServiceError('userid is required');
  }
  if (!payload.roleid?.trim()) {
    throw new ServiceError('roleid is required');
  }

  const exists = await selectRows<UserRoleRecord>(TABLES.userRole, {
    filters: { userid: payload.userid, roleid: payload.roleid },
    limit: 1,
  });

  if (exists[0]) {
    return exists[0];
  }

  const rows = await insertRows<UserRoleRecord>(TABLES.userRole, { ...payload });
  if (!rows[0]) {
    throw new ServiceError('assignRole failed: no row returned');
  }

  return rows[0];
}
