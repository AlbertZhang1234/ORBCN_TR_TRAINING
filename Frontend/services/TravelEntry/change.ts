import { ServiceError } from '../_core/error';
import { updateRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export async function changeTravelEntry(
  travelId: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!travelId?.trim()) {
    throw new ServiceError('travelId is required');
  }

  if (!patch || Object.keys(patch).length === 0) {
    throw new ServiceError('patch is empty');
  }

  const rows = await updateRows(TABLES.travelEntry, { travelid: travelId }, patch);
  if (!rows[0]) {
    throw new ServiceError(`changeTravelEntry failed: travel ${travelId} not found`);
  }

  return rows[0];
}
