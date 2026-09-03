import { emptyHeader, type EditableHeader, type EditableLine } from './supplier-draft-model';

export interface SupplierInvoiceHeader extends EditableHeader {
  userid: string;
  travelid: string;
  originalamount: number | null;
  originalcurrency: string;
  status: string;
}
export interface SupplierInvoiceDetail {
  header: SupplierInvoiceHeader;
  lines: EditableLine[];
  revision: string;
}

const numeric = (value: unknown): number | null => value == null || value === '' ? null : Number(value);
export function supplierInvoiceContent(row: Record<string, unknown>, items: Record<string, unknown>[]) {
  const header = { ...emptyHeader('01'), userid: '', travelid: '', originalamount: null,
    originalcurrency: '', status: '' } as SupplierInvoiceHeader;
  for (const key of Object.keys(header) as Array<keyof SupplierInvoiceHeader>) {
    Object.assign(header, { [key]: ['totalnetamount', 'taxamount', 'grossamount', 'originalamount'].includes(key)
      ? numeric(row[key]) : String(row[key] ?? '') });
  }
  header.invoicedate = header.invoicedate.slice(0, 10);
  const lines: EditableLine[] = items.map((item) => ({
    key: `line-${item.seqno}`, description: String(item.description ?? ''), spec_model: String(item.spec_model ?? ''),
    quantity: numeric(item.quantity), unit_price: numeric(item.unit_price), amount_excl_tax: numeric(item.amount_excl_tax),
    tax_rate: String(item.tax_rate ?? ''), amount_incl_tax: numeric(item.amount_incl_tax),
  }));
  return { header, lines };
}
