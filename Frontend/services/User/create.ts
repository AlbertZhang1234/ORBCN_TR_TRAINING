import { ServiceError } from '../_core/error';
import { insertRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export interface UserRecord extends Record<string, unknown> {
  userid: string;
  email: string;
  firstname: string;
  lastname: string;
  password: string;
  mobile?: string;
  sap_supplier_id?: string;
}

export async function createUser(user: UserRecord): Promise<UserRecord> {
  if (!user.userid?.trim()) {
    throw new ServiceError('userid is required');
  }
  if (!user.email?.trim()) {
    throw new ServiceError('email is required');
  }
  if (!user.password?.trim()) {
    throw new ServiceError('password is required');
  }
  if (user.sap_supplier_id && user.sap_supplier_id.trim().length > 10) {
    throw new ServiceError('SAP Supplier ID must not exceed 10 characters');
  }

  const rows = await insertRows<UserRecord>(TABLES.user, user);
  if (!rows[0]) {
    throw new ServiceError('createUser failed: no row returned');
  }

  return rows[0];
}
