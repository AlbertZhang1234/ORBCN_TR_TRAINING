import { ServiceError } from '../_core/error';
import { updateRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export async function changeCustomer(
  customerId: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!customerId?.trim()) {
    throw new ServiceError('customerId is required');
  }

  if (!patch || Object.keys(patch).length === 0) {
    throw new ServiceError('patch is empty');
  }

  const rows = await updateRows(TABLES.customer, { customerid: customerId }, patch);
  if (!rows[0]) {
    throw new ServiceError(`changeCustomer failed: customer ${customerId} not found`);
  }

  return rows[0];
}
