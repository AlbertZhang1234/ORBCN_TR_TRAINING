import { ServiceError } from '../_core/error';
import { updateRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export async function changeUser(
  userId: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!userId?.trim()) {
    throw new ServiceError('userId is required');
  }

  if (!patch || Object.keys(patch).length === 0) {
    throw new ServiceError('patch is empty');
  }

  const rows = await updateRows(TABLES.user, { userid: userId }, patch);
  if (!rows[0]) {
    throw new ServiceError(`changeUser failed: user ${userId} not found`);
  }

  return rows[0];
}
