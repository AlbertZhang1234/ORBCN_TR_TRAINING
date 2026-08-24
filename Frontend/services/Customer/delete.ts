import { ServiceError } from '../_core/error';
import { deleteRows, selectRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export async function deleteCustomer(customerId: string): Promise<boolean> {
  if (!customerId?.trim()) {
    throw new ServiceError('customerId is required');
  }

  // project may use customerid or customer (legacy naming)
  const byCustomerId = await selectRows(TABLES.project, {
    select: 'projectid',
    filters: { customerid: customerId },
    limit: 1,
  }).catch(() => []);

  const byCustomer = await selectRows(TABLES.project, {
    select: 'projectid',
    filters: { customer: customerId },
    limit: 1,
  }).catch(() => []);

  if (byCustomerId.length > 0 || byCustomer.length > 0) {
    throw new ServiceError(
      `Customer ${customerId} has related projects and cannot be deleted`,
    );
  }

  const deleted = await deleteRows(TABLES.customer, { customerid: customerId });
  return deleted.length > 0;
}
