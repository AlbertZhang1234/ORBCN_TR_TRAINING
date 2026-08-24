import { ServiceError } from '../_core/error';
import { deleteRows, selectRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export async function deleteRole(roleId: string): Promise<boolean> {
  if (!roleId?.trim()) {
    throw new ServiceError('roleId is required');
  }

  const inUse = await selectRows(TABLES.userRole, {
    select: 'userid',
    filters: { roleid: roleId },
    limit: 1,
  });

  if (inUse.length > 0) {
    throw new ServiceError(`Role ${roleId} is assigned to users and cannot be deleted`);
  }

  const rows = await deleteRows(TABLES.role, { roleid: roleId });
  return rows.length > 0;
}
