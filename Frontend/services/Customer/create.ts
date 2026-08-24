import { ServiceError } from '../_core/error';
import { insertRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export interface CustomerRecord extends Record<string, unknown> {
  customerid: string;
  customername?: string;
  taxcode?: string;
  address?: string;
  contactperson?: string;
  mobile?: string;
  fullname_zh?: string;
  fullname_en?: string;
  email?: string;
  language?: string;
  actualpaymentterm?: string;
  bankaccount?: string;
}

export async function createCustomer(customer: CustomerRecord): Promise<CustomerRecord> {
  if (!customer.customerid?.trim()) {
    throw new ServiceError('customerid is required');
  }

  const rows = await insertRows<CustomerRecord>(TABLES.customer, customer);
  if (!rows[0]) {
    throw new ServiceError('createCustomer failed: no row returned');
  }

  return rows[0];
}
