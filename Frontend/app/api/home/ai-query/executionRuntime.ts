import { query } from '../../../../lib/db';
import type {
  OttoAuthContext,
  OttoMetric,
  OttoQueryResult,
  OttoRecordRow,
  OttoToolInput,
  OttoRuntimeMetadata,
} from './ottoVTrAllTool';

interface CompanionInsight {
  invoiceCount: number;
  reimbursementCount: number;
  grossAmount: number;
}

interface AggregateRow {
  row_count?: number | string;
  reimbursement_count?: number | string;
  invoice_count?: number | string;
  line_count?: number | string;
  gross_sum?: number | string;
  totalnet_sum?: number | string;
  tax_sum?: number | string;
  tr_amount_sum?: number | string;
  first_date?: string | null;
  last_date?: string | null;
}

interface GroupedRowSql {
  label?: string | null;
  reimbursement_count?: number | string;
  invoice_count?: number | string;
  line_count?: number | string;
  gross_sum?: number | string;
  totalnet_sum?: number | string;
  tax_sum?: number | string;
  tr_amount_sum?: number | string;
}

interface RecordRowSql {
  tr_id?: number | string;
  trno?: string | null;
  tr_user_name?: string | null;
  project_description?: string | null;
  customername?: string | null;
  approvalstatus?: string | null;
  bookingstatus?: string | null;
  approver_name?: string | null;
  invoiceno?: string | null;
  tr_amount?: number | string | null;
  totalnetamount?: number | string | null;
  taxamount?: number | string | null;
  grossamount?: number | string | null;
  currency?: string | null;
  invoicedate?: string | null;
  tr_created_at?: string | null;
  travel_fromdate?: string | null;
  travel_todate?: string | null;
  travel_destination?: string | null;
  bookingcode?: string | null;
  invoice_status?: string | null;
  invoice_supplier?: string | null;
  invoice_description?: string | null;
}

interface ExecutionDeps {
  buildWhereClause: (params: unknown[], ctx: OttoAuthContext, plan: OttoToolInput) => string;
  toFiniteNumber: (value: unknown) => number;
  toText: (value: unknown) => string;
}

function formatMoney(value: number): string {
  return `¥${value.toFixed(2)}`;
}

function metricOrderBy(metric: OttoMetric, direction: 'asc' | 'desc'): string {
  const dir = direction === 'asc' ? 'ASC' : 'DESC';
  switch (metric) {
    case 'invoice_count':
      return '"invoice_count" ' + dir + ', "gross_sum" DESC';
    case 'reimbursement_count':
      return '"reimbursement_count" ' + dir + ', "gross_sum" DESC';
    case 'line_count':
      return '"line_count" ' + dir + ', "gross_sum" DESC';
    case 'totalnetamount':
      return '"totalnet_sum" ' + dir + ', "gross_sum" DESC';
    case 'taxamount':
      return '"tax_sum" ' + dir + ', "gross_sum" DESC';
    case 'tr_amount':
      return '"tr_amount_sum" ' + dir + ', "gross_sum" DESC';
    default:
      return '"gross_sum" ' + dir + ', "invoice_count" DESC';
  }
}

function buildGroupOrderBy(plan: OttoToolInput): string {
  if (!plan.sortBy || plan.sortBy === 'metric') {
    return metricOrderBy(plan.metric, plan.sortDirection);
  }
  return metricOrderBy(plan.metric, plan.sortDirection);
}

function buildRecordOrderBy(plan: OttoToolInput): string {
  const dir = plan.sortDirection === 'asc' ? 'ASC' : 'DESC';
  switch (plan.sortBy) {
    case 'invoicedate':
    case 'tr_created_at':
    case 'travel_fromdate':
    case 'travel_todate':
      return `"${plan.sortBy}" ${dir} NULLS LAST, "tr_created_at" DESC NULLS LAST`;
    case 'tr_amount':
    case 'grossamount':
    case 'totalnetamount':
    case 'taxamount':
      return `COALESCE("${plan.sortBy}", 0) ${dir} NULLS LAST, "invoicedate" DESC NULLS LAST`;
    case 'trno':
    case 'invoiceno':
      return `"${plan.sortBy}" ${dir} NULLS LAST, "invoicedate" DESC NULLS LAST`;
    default:
      return 'COALESCE("grossamount", "totalnetamount", "tr_amount", 0) DESC NULLS LAST, "invoicedate" DESC NULLS LAST';
  }
}

export async function executeOttoToolRuntime(
  plan: OttoToolInput,
  ctx: OttoAuthContext,
  metadata: OttoRuntimeMetadata,
  deps: ExecutionDeps,
): Promise<OttoQueryResult> {
  const params: unknown[] = [];
  const whereClause = deps.buildWhereClause(params, ctx, plan);
  const filteredCte = `WITH filtered AS (SELECT * FROM "otto_v_tr_all" WHERE ${whereClause})`;
  const notes: string[] = [];

  if (plan.groupBy && (metadata.nonEmptyCounts[plan.groupBy] ?? 0) === 0) {
    notes.push(`Field ${plan.groupBy} currently has no non-empty values in visible data.`);
  }

  const aggregateRows = await query<AggregateRow>(
    `${filteredCte}
     SELECT
       COUNT(*) AS row_count,
       COUNT(DISTINCT "tr_id") AS reimbursement_count,
       COUNT(DISTINCT NULLIF("invoiceno", '')) AS invoice_count,
       COUNT(*) AS line_count,
       COALESCE(SUM(COALESCE("grossamount", 0)), 0) AS gross_sum,
       COALESCE(SUM(COALESCE("totalnetamount", 0)), 0) AS totalnet_sum,
       COALESCE(SUM(COALESCE("taxamount", 0)), 0) AS tax_sum,
       COALESCE(SUM(COALESCE("tr_amount", 0)), 0) AS tr_amount_sum,
       MIN(COALESCE(DATE("invoicedate"), DATE("travel_fromdate"), DATE("tr_created_at"), DATE("travel_todate")))::text AS first_date,
       MAX(COALESCE(DATE("invoicedate"), DATE("travel_todate"), DATE("tr_created_at"), DATE("travel_fromdate")))::text AS last_date
     FROM filtered`,
    params,
  );

  const aggregate = aggregateRows[0] ?? {};
  const result: OttoQueryResult = {
    aggregate: {
      rowCount: Math.trunc(deps.toFiniteNumber(aggregate.row_count)),
      reimbursementCount: Math.trunc(deps.toFiniteNumber(aggregate.reimbursement_count)),
      invoiceCount: Math.trunc(deps.toFiniteNumber(aggregate.invoice_count)),
      lineCount: Math.trunc(deps.toFiniteNumber(aggregate.line_count)),
      grossAmount: deps.toFiniteNumber(aggregate.gross_sum),
      totalNetAmount: deps.toFiniteNumber(aggregate.totalnet_sum),
      taxAmount: deps.toFiniteNumber(aggregate.tax_sum),
      trAmount: deps.toFiniteNumber(aggregate.tr_amount_sum),
      firstDate: deps.toText(aggregate.first_date),
      lastDate: deps.toText(aggregate.last_date),
    },
    groupedRows: [],
    records: [],
    notes,
  };

  if (result.aggregate.rowCount <= 0) {
    return result;
  }

  if (plan.operation === 'grouped' && plan.groupBy) {
    const groupedRows = await query<GroupedRowSql>(
      `${filteredCte}
       SELECT
         NULLIF(TRIM(COALESCE("${plan.groupBy}"::text, '')), '') AS label,
         COUNT(DISTINCT "tr_id") AS reimbursement_count,
         COUNT(DISTINCT NULLIF("invoiceno", '')) AS invoice_count,
         COUNT(*) AS line_count,
         COALESCE(SUM(COALESCE("grossamount", 0)), 0) AS gross_sum,
         COALESCE(SUM(COALESCE("totalnetamount", 0)), 0) AS totalnet_sum,
         COALESCE(SUM(COALESCE("taxamount", 0)), 0) AS tax_sum,
         COALESCE(SUM(COALESCE("tr_amount", 0)), 0) AS tr_amount_sum
       FROM filtered
       WHERE NULLIF(TRIM(COALESCE("${plan.groupBy}"::text, '')), '') IS NOT NULL
       GROUP BY 1
       ORDER BY ${buildGroupOrderBy(plan)}
       LIMIT ${Math.max(5, plan.limit)}`,
      params,
    );

    result.groupedRows = groupedRows.map((row) => ({
      label: deps.toText(row.label),
      reimbursementCount: Math.trunc(deps.toFiniteNumber(row.reimbursement_count)),
      invoiceCount: Math.trunc(deps.toFiniteNumber(row.invoice_count)),
      lineCount: Math.trunc(deps.toFiniteNumber(row.line_count)),
      grossAmount: deps.toFiniteNumber(row.gross_sum),
      totalNetAmount: deps.toFiniteNumber(row.totalnet_sum),
      taxAmount: deps.toFiniteNumber(row.tax_sum),
      trAmount: deps.toFiniteNumber(row.tr_amount_sum),
    }));

    if (result.groupedRows.length === 0) {
      result.notes.push(`No non-empty grouped values available for ${plan.groupBy}.`);
    }
  }

  const recordRows = await query<RecordRowSql>(
    `${filteredCte}
     SELECT
       tr_id,
       trno,
       tr_user_name,
       project_description,
       customername,
       approvalstatus,
       bookingstatus,
       approver_name,
       invoiceno,
       tr_amount,
       totalnetamount,
       taxamount,
       grossamount,
       currency,
       invoicedate,
       tr_created_at,
       travel_fromdate,
       travel_todate,
       travel_destination,
       bookingcode,
       invoice_status,
       invoice_supplier,
       invoice_description
     FROM filtered
     ORDER BY ${buildRecordOrderBy(plan)}
     LIMIT ${plan.limit}`,
    params,
  );

  result.records = recordRows.map((row): OttoRecordRow => ({
    trId: Math.trunc(deps.toFiniteNumber(row.tr_id)),
    trno: deps.toText(row.trno),
    trUserName: deps.toText(row.tr_user_name),
    projectDescription: deps.toText(row.project_description),
    customerName: deps.toText(row.customername),
    approvalStatus: deps.toText(row.approvalstatus),
    bookingStatus: deps.toText(row.bookingstatus),
    approverName: deps.toText(row.approver_name),
    invoiceNo: deps.toText(row.invoiceno),
    trAmount: deps.toFiniteNumber(row.tr_amount),
    totalNetAmount: deps.toFiniteNumber(row.totalnetamount),
    taxAmount: deps.toFiniteNumber(row.taxamount),
    grossAmount: deps.toFiniteNumber(row.grossamount),
    currency: deps.toText(row.currency),
    invoiceDate: deps.toText(row.invoicedate),
    createdAt: deps.toText(row.tr_created_at),
    travelFromDate: deps.toText(row.travel_fromdate),
    travelToDate: deps.toText(row.travel_todate),
    travelDestination: deps.toText(row.travel_destination),
    bookingCode: deps.toText(row.bookingcode),
    invoiceStatus: deps.toText(row.invoice_status),
    invoiceSupplier: deps.toText(row.invoice_supplier),
    invoiceDescription: deps.toText(row.invoice_description),
  }));

  return result;
}

function isReimbursementQuestion(question: string): boolean {
  return /(报销|报销单|reimbursement)/i.test(question);
}

export async function loadInvoiceDateCompanionInsightRuntime(
  question: string,
  ctx: OttoAuthContext,
  plan: OttoToolInput,
  deps: ExecutionDeps,
): Promise<CompanionInsight | null> {
  if (!isReimbursementQuestion(question)) {
    return null;
  }
  if (!plan.dateFrom || !plan.dateTo || plan.dateField === 'invoicedate') {
    return null;
  }

  const params: unknown[] = [];
  const invoiceDatePlan: OttoToolInput = {
    ...plan,
    dateField: 'invoicedate',
  };
  const whereClause = deps.buildWhereClause(params, ctx, invoiceDatePlan);
  const rows = await query<AggregateRow>(
    `WITH companion AS (SELECT * FROM "otto_v_tr_all" WHERE ${whereClause})
     SELECT
       COUNT(DISTINCT "tr_id") AS reimbursement_count,
       COUNT(DISTINCT NULLIF("invoiceno", '')) AS invoice_count,
       COALESCE(SUM(COALESCE("grossamount", 0)), 0) AS gross_sum
     FROM companion`,
    params,
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  const invoiceCount = Math.trunc(deps.toFiniteNumber(row.invoice_count));
  if (invoiceCount <= 0) {
    return null;
  }

  return {
    invoiceCount,
    reimbursementCount: Math.trunc(deps.toFiniteNumber(row.reimbursement_count)),
    grossAmount: deps.toFiniteNumber(row.gross_sum),
  };
}

export function appendServiceAwareNotesRuntime(
  question: string,
  plan: OttoToolInput,
  result: OttoQueryResult,
  insight: CompanionInsight | null,
): void {
  if (!insight || result.aggregate.reimbursementCount > 0) {
    return;
  }

  if (plan.language === 'en') {
    result.notes.push(
      `No reimbursements matched on ${plan.dateField}, but by invoice date the same conditions still match ${insight.invoiceCount} invoices, involving ${insight.reimbursementCount} reimbursements and ${formatMoney(insight.grossAmount)} in gross amount.`,
    );
    return;
  }

  result.notes.push(
    `按 ${plan.dateField} 这个时间口径没有命中报销单；但改看发票日期时，同条件下仍有 ${insight.invoiceCount} 张发票，关联 ${insight.reimbursementCount} 张报销单，发票总额 ${formatMoney(insight.grossAmount)}。`,
  );
}
