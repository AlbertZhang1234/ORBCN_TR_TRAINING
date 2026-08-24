import { query } from '../../../../lib/db';
import type { OttoAuthContext, OttoMetric, OttoToolInput } from './ottoVTrAllTool';
import type { CardDimension } from './cardRuntime';

interface CardDataDeps {
  buildWhereClause: (params: unknown[], ctx: OttoAuthContext, plan: OttoToolInput) => string;
  toText: (value: unknown) => string;
  toFiniteNumber: (value: unknown) => number;
}

function metricSql(metric: OttoMetric): string {
  switch (metric) {
    case 'invoice_count':
      return 'COUNT(DISTINCT NULLIF("invoiceno", \'\'))';
    case 'reimbursement_count':
      return 'COUNT(DISTINCT "tr_id")';
    case 'line_count':
      return 'COUNT(*)';
    case 'totalnetamount':
      return 'COALESCE(SUM(COALESCE("totalnetamount", 0)), 0)';
    case 'taxamount':
      return 'COALESCE(SUM(COALESCE("taxamount", 0)), 0)';
    case 'tr_amount':
      return 'COALESCE(SUM(COALESCE("tr_amount", 0)), 0)';
    default:
      return 'COALESCE(SUM(COALESCE("grossamount", 0)), 0)';
  }
}

export async function loadGroupedRowsForCardData(
  ctx: OttoAuthContext,
  plan: OttoToolInput,
  dimension: CardDimension,
  metric: OttoMetric,
  topN: number,
  deps: CardDataDeps,
): Promise<Array<{ name: string; value: number }>> {
  const params: unknown[] = [];
  const whereClause = deps.buildWhereClause(params, ctx, plan);
  const rows = await query<{ name?: string | null; metric_value?: number | string }>(
    `WITH filtered AS (SELECT * FROM "otto_v_tr_all" WHERE ${whereClause})
     SELECT
       NULLIF(TRIM(COALESCE("${dimension}"::text, '')), '') AS name,
       ${metricSql(metric)} AS metric_value
     FROM filtered
     WHERE NULLIF(TRIM(COALESCE("${dimension}"::text, '')), '') IS NOT NULL
     GROUP BY 1
     ORDER BY metric_value DESC NULLS LAST, name ASC
     LIMIT ${Math.min(10, Math.max(3, topN))}`,
    params,
  );

  return rows
    .map((row) => ({ name: deps.toText(row.name), value: deps.toFiniteNumber(row.metric_value) }))
    .filter((row) => row.name && Number.isFinite(row.value));
}
