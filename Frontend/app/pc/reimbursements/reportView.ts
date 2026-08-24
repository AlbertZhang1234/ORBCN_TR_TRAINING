import type { ReimbursementListRow } from '../../../services/TravelReimbursement/list';
import type { TravelReportRow } from '../../../services/TravelReport/list';

function buildReimbursementKey(row: TravelReportRow): string {
  const id = Number(row.tr_id);
  if (Number.isFinite(id) && id > 0) {
    return String(id);
  }
  return String(row.trno ?? '').trim();
}

function toFiniteAmount(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function groupReportRowsToReimbursements(
  rows: TravelReportRow[],
): ReimbursementListRow[] {
  const grouped = new Map<
    string,
    ReimbursementListRow & {
      _invoiceNos: Set<string>;
    }
  >();

  for (const row of rows) {
    const key = buildReimbursementKey(row);
    if (!key) {
      continue;
    }

    const existing = grouped.get(key);
    const invoiceNo = String(row.invoiceno ?? '').trim();
    const amount = toFiniteAmount(row.tr_amount);

    if (existing) {
      existing.total_amount = toFiniteAmount(existing.total_amount) + amount;
      if (invoiceNo) {
        existing._invoiceNos.add(invoiceNo);
        existing.invoice_count = existing._invoiceNos.size;
      }
      continue;
    }

    grouped.set(key, {
      id: Number.isFinite(Number(row.tr_id)) ? Number(row.tr_id) : undefined,
      trno: String(row.trno ?? '').trim(),
      userid: String(row.tr_userid ?? '').trim(),
      projectid: String(row.tr_projectid ?? '').trim(),
      project_description: String(row.project_description ?? '').trim(),
      created_at: String(row.tr_created_at ?? '').trim(),
      createdat: String(row.tr_created_at ?? '').trim(),
      bookingstatus: String(row.bookingstatus ?? '').trim(),
      booking_status: String(row.bookingstatus ?? '').trim(),
      approvalstatus: String(row.approvalstatus ?? '').trim(),
      approval_status: String(row.approvalstatus ?? '').trim(),
      approver: String(row.approver_userid ?? '').trim(),
      approvalby: String(row.approver_userid ?? '').trim(),
      approvedby: String(row.approver_userid ?? '').trim(),
      approver_name: String(row.approver_name ?? '').trim(),
      total_amount: amount,
      invoice_count: invoiceNo ? 1 : 0,
      _invoiceNos: new Set(invoiceNo ? [invoiceNo] : []),
    });
  }

  return Array.from(grouped.values())
    .map(({ _invoiceNos, ...row }) => row)
    .sort((a, b) => {
      const idA = Number(a.id ?? 0);
      const idB = Number(b.id ?? 0);
      if (Number.isFinite(idA) && Number.isFinite(idB) && idA !== idB) {
        return idB - idA;
      }
      return String(b.trno ?? '').localeCompare(String(a.trno ?? ''));
    });
}
