import { query } from '../../../../lib/db';
import { buildTravelReportVisibilityClause } from '../../../../services/TravelReport/server';
import { FIELD_DEFINITIONS, VALUE_HINT_FIELDS } from './ottoSchema';
import type { OttoAuthContext, OttoField, OttoRuntimeMetadata } from './ottoVTrAllTool';

interface AggregateRow {
  row_count?: number | string;
  reimbursement_count?: number | string;
  invoice_count?: number | string;
}

interface MetadataDeps {
  toText: (value: unknown) => string;
  toFiniteNumber: (value: unknown) => number;
}

const metadataCache = new Map<string, { expiresAt: number; data: OttoRuntimeMetadata }>();

function cacheKey(ctx: OttoAuthContext): string {
  const parts = [ctx.requesterUserId, ctx.requestUserId, ctx.canViewAll];
  return parts.join('|');
}

function buildVisibleCte(ctx: OttoAuthContext, params: unknown[]): string {
  return `WITH visible AS (SELECT * FROM "otto_v_tr_all" WHERE ${buildTravelReportVisibilityClause(params, ctx)})`;
}

export async function loadRuntimeMetadataRuntime(ctx: OttoAuthContext, deps: MetadataDeps): Promise<OttoRuntimeMetadata> {
  const key = cacheKey(ctx);
  const cached = metadataCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const params: unknown[] = [];
  const visibleCte = buildVisibleCte(ctx, params);
  const availabilitySql = Object.keys(FIELD_DEFINITIONS)
    .map((field) => `COUNT(*) FILTER (WHERE NULLIF(TRIM(COALESCE("${field}"::text, '')), '') IS NOT NULL) AS "${field}"`)
    .join(',\n');

  const [summaryRows, ...hintRows] = await Promise.all([
    query<AggregateRow>(
      `${visibleCte}
       SELECT
         COUNT(*) AS row_count,
         COUNT(DISTINCT "tr_id") AS reimbursement_count,
         COUNT(DISTINCT NULLIF("invoiceno", '')) AS invoice_count,
         ${availabilitySql}
       FROM visible`,
      params,
    ),
    ...VALUE_HINT_FIELDS.map((field) =>
      query<{ value?: string | null; count?: number | string }>(
        `${visibleCte}
         SELECT
           NULLIF(TRIM(COALESCE("${field}"::text, '')), '') AS value,
           COUNT(*) AS count
         FROM visible
         WHERE NULLIF(TRIM(COALESCE("${field}"::text, '')), '') IS NOT NULL
         GROUP BY 1
         ORDER BY COUNT(*) DESC, 1 ASC
         LIMIT 8`,
        params,
      ),
    ),
  ]);

  const summaryRow = summaryRows[0] ?? {};
  const nonEmptyCounts: Partial<Record<OttoField, number>> = {};
  for (const field of Object.keys(FIELD_DEFINITIONS) as OttoField[]) {
    nonEmptyCounts[field] = Math.trunc(deps.toFiniteNumber((summaryRow as Record<string, unknown>)[field]));
  }

  const topValues: Partial<Record<OttoField, Array<{ value: string; count: number }>>> = {};
  VALUE_HINT_FIELDS.forEach((field, index) => {
    topValues[field] = hintRows[index]
      .map((item) => ({ value: deps.toText(item.value), count: Math.trunc(deps.toFiniteNumber(item.count)) }))
      .filter((item) => item.value);
  });

  const metadata: OttoRuntimeMetadata = {
    summary: {
      rowCount: Math.trunc(deps.toFiniteNumber(summaryRow.row_count)),
      reimbursementCount: Math.trunc(deps.toFiniteNumber(summaryRow.reimbursement_count)),
      invoiceCount: Math.trunc(deps.toFiniteNumber(summaryRow.invoice_count)),
    },
    nonEmptyCounts,
    topValues,
  };

  metadataCache.set(key, { expiresAt: Date.now() + 60_000, data: metadata });
  return metadata;
}
