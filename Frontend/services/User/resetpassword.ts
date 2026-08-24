import { ServiceError } from '../_core/error';
import { updateRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';
import bcrypt from 'bcryptjs';

export async function resetPassword(
  userId: string,
  newPassword: string,
): Promise<Record<string, unknown>> {
  if (!userId?.trim()) {
    throw new ServiceError('userId is required');
  }
  if (!newPassword?.trim()) {
    throw new ServiceError('newPassword is required');
  }
  if (newPassword.length < 8) {
    throw new ServiceError('newPassword must be at least 8 characters');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  const rows = await updateRows(TABLES.user, { userid: userId }, { password: hashedPassword });
  if (!rows[0]) {
    throw new ServiceError(`resetPassword failed: user ${userId} not found`);
  }

  return rows[0];
}
