import { selectRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export interface InvoiceListRow extends Record<string, unknown> {
  invoiceno: string;
  userid?: string;
  travelid?: string;
  invoicedate?: string;
  totalnetamount?: number;
  totalnetamour?: number;
  taxamount?: number;
  grossamount?: number;
  bookingcode?: string;
  businesstype?: string;
  currency?: string;
  originalamount?: number;
  originalcurrency?: string;
  status?: string;
  comment?: string;
  description?: string;
  supplier?: string;
}

export async function listInvoices(): Promise<InvoiceListRow[]> {
  return selectRows<InvoiceListRow>(TABLES.invoice, {
    orderBy: { column: 'invoiceno', ascending: true },
  });
}
