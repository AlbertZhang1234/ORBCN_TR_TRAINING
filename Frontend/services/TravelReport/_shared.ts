export interface TravelReportRow extends Record<string, unknown> {
  tr_id: number;
  trno: string;
  tr_created_at: string;
  tr_userid: string;
  tr_user_name: string;
  tr_projectid: string;
  project_description: string;
  project_manager_userid: string;
  project_manager_name: string;
  customerid: string;
  customername: string;
  approvalstatus: string;
  bookingstatus: string;
  approver_userid: string;
  approver_name: string;
  invoiceno: string;
  tr_amount?: number;
  line_trchargeable?: boolean;
  line_txchargeable?: boolean;
  invoice_userid: string;
  invoice_user_name: string;
  travelid: string;
  travel_fromdate: string;
  travel_todate: string;
  travel_destination: string;
  invoicedate: string;
  totalnetamount?: number;
  taxamount?: number;
  grossamount?: number;
  bookingcode: string;
  currency: string;
  invoice_status: string;
  invoice_comment: string;
  invoice_description: string;
  invoice_supplier: string;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (lowered === 'true') {
      return true;
    }
    if (lowered === 'false') {
      return false;
    }
  }
  return undefined;
}

function toText(value: unknown): string {
  return String(value ?? '').trim();
}

export function normalizeTravelReportRow(row: TravelReportRow): TravelReportRow {
  return {
    ...row,
    tr_id: toNumber(row.tr_id) ?? 0,
    trno: toText(row.trno),
    tr_created_at: toText(row.tr_created_at),
    tr_userid: toText(row.tr_userid),
    tr_user_name: toText(row.tr_user_name),
    tr_projectid: toText(row.tr_projectid),
    project_description: toText(row.project_description),
    project_manager_userid: toText(row.project_manager_userid),
    project_manager_name: toText(row.project_manager_name),
    customerid: toText(row.customerid),
    customername: toText(row.customername),
    approvalstatus: toText(row.approvalstatus),
    bookingstatus: toText(row.bookingstatus),
    approver_userid: toText(row.approver_userid),
    approver_name: toText(row.approver_name),
    invoiceno: toText(row.invoiceno),
    tr_amount: toNumber(row.tr_amount),
    line_trchargeable: toBoolean(row.line_trchargeable),
    line_txchargeable: toBoolean(row.line_txchargeable),
    invoice_userid: toText(row.invoice_userid),
    invoice_user_name: toText(row.invoice_user_name),
    travelid: toText(row.travelid),
    travel_fromdate: toText(row.travel_fromdate),
    travel_todate: toText(row.travel_todate),
    travel_destination: toText(row.travel_destination),
    invoicedate: toText(row.invoicedate),
    totalnetamount: toNumber(row.totalnetamount),
    taxamount: toNumber(row.taxamount),
    grossamount: toNumber(row.grossamount),
    bookingcode: toText(row.bookingcode),
    currency: toText(row.currency),
    invoice_status: toText(row.invoice_status),
    invoice_comment: toText(row.invoice_comment),
    invoice_description: toText(row.invoice_description),
    invoice_supplier: toText(row.invoice_supplier),
  };
}
