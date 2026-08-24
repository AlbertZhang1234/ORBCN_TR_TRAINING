import { ServiceError } from '../_core/error';
import { deleteRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export async function removeRole(userId: string, roleId: string): Promise<boolean> {
  if (!userId?.trim()) {
    throw new ServiceError('userId is required');
  }
  if (!roleId?.trim()) {
    throw new ServiceError('roleId is required');
  }

  const rows = await deleteRows(TABLES.userRole, { userid: userId, roleid: roleId });
  return rows.length > 0;
}
