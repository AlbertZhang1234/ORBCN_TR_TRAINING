import { ServiceError } from '../_core/error';
import { deleteRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export async function deleteTravelEntry(travelId: string): Promise<boolean> {
  if (!travelId?.trim()) {
    throw new ServiceError('travelId is required');
  }

  const deleted = await deleteRows(TABLES.travelEntry, { travelid: travelId });
  return deleted.length > 0;
}
