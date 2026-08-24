import { selectRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export interface CustomerListRow extends Record<string, unknown> {
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

export async function listCustomers(): Promise<CustomerListRow[]> {
  return selectRows<CustomerListRow>(TABLES.customer, {
    orderBy: { column: 'customerid', ascending: true },
  });
}
