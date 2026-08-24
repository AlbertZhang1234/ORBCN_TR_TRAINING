import { ServiceError } from '../_core/error';
import { deleteRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export async function deleteUser(userId: string): Promise<boolean> {
  if (!userId?.trim()) {
    throw new ServiceError('userId is required');
  }

  await deleteRows(TABLES.userRole, { userid: userId });
  const deleted = await deleteRows(TABLES.user, { userid: userId });
  return deleted.length > 0;
}
