import { buildTravelReportOwnerClause, buildTravelReportVisibilityClause } from '../../../../services/TravelReport/server';
import { FIELD_DEFINITIONS, METRIC_TO_SQL, SEARCHABLE_FIELDS } from './ottoSchema';
import type { OttoAuthContext, OttoDateField, OttoField, OttoFilter, OttoGroupField, OttoSortField, OttoToolInput } from './ottoVTrAllTool';

interface QueryRuntimeDeps {
  toText: (value: unknown) => string;
  toFiniteNumber: (value: unknown) => number;
  normalizeBoolean: (value: unknown) => boolean | null;
  pushParam: (params: unknown[], value: unknown) => string;
}

export function isOttoField(value: string): value is OttoField {
  return value in FIELD_DEFINITIONS;
}

export function isGroupField(value: string): value is OttoGroupField {
  return (
    value === 'tr_user_name' ||
    value === 'project_description' ||
    value === 'customername' ||
    value === 'approver_name' ||
    value === 'project_manager_name' ||
    value === 'invoice_user_name' ||
    value === 'invoice_supplier' ||
    value === 'invoice_description' ||
    value === 'travel_destination' ||
    value === 'bookingcode' ||
    value === 'approvalstatus' ||
    value === 'bookingstatus' ||
    value === 'invoice_status' ||
    value === 'currency'
  );
}

export function isDateField(value: string): value is OttoDateField {
  return value === 'invoicedate' || value === 'tr_created_at' || value === 'travel_fromdate' || value === 'travel_todate';
}

export function isSortField(value: string): value is OttoSortField {
  return (
    value === 'metric' ||
    value === 'invoicedate' ||
    value === 'tr_created_at' ||
    value === 'travel_fromdate' ||
    value === 'travel_todate' ||
    value === 'grossamount' ||
    value === 'totalnetamount' ||
    value === 'taxamount' ||
    value === 'tr_amount' ||
    value === 'trno' ||
    value === 'invoiceno'
  );
}

function buildSearchDocumentSql(): string {
  return `LOWER(CONCAT_WS(' ', ${SEARCHABLE_FIELDS.map((field) => `COALESCE("${field}"::text, '')`).join(', ')}))`;
}

function buildFilterClause(params: unknown[], filter: OttoFilter, deps: QueryRuntimeDeps): string | null {
  const definition = FIELD_DEFINITIONS[filter.field];
  const column = `"${filter.field}"`;

  if (filter.operator === 'is_null') {
    return `NULLIF(TRIM(COALESCE(${column}::text, '')), '') IS NULL`;
  }
  if (filter.operator === 'not_null') {
    return `NULLIF(TRIM(COALESCE(${column}::text, '')), '') IS NOT NULL`;
  }

  if (definition.type === 'number') {
    if (filter.operator === 'in' && Array.isArray(filter.value)) {
      const placeholders = filter.value.map((item) => deps.pushParam(params, deps.toFiniteNumber(item)));
      return `${column} IN (${placeholders.join(', ')})`;
    }
    const value = Array.isArray(filter.value) ? deps.toFiniteNumber(filter.value[0]) : deps.toFiniteNumber(filter.value);
    const placeholder = deps.pushParam(params, value);
    if (filter.operator === 'gte') {
      return `COALESCE(${column}, 0) >= ${placeholder}`;
    }
    if (filter.operator === 'lte') {
      return `COALESCE(${column}, 0) <= ${placeholder}`;
    }
    return `COALESCE(${column}, 0) = ${placeholder}`;
  }

  if (definition.type === 'boolean') {
    if (filter.operator === 'in' && Array.isArray(filter.value)) {
      const placeholders = filter.value.map((item) => deps.pushParam(params, Boolean(item)));
      return `${column} IN (${placeholders.join(', ')})`;
    }
    const placeholder = deps.pushParam(params, Boolean(Array.isArray(filter.value) ? filter.value[0] : filter.value));
    return `${column} = ${placeholder}`;
  }

  if (definition.type === 'date' || definition.type === 'timestamp') {
    const rawValue = Array.isArray(filter.value) ? deps.toText(filter.value[0]) : deps.toText(filter.value);
    const placeholder = deps.pushParam(params, rawValue);
    if (filter.operator === 'gte') {
      return `DATE(${column}) >= ${placeholder}::date`;
    }
    if (filter.operator === 'lte') {
      return `DATE(${column}) <= ${placeholder}::date`;
    }
    if (filter.operator === 'contains') {
      return `LOWER(COALESCE(${column}::text, '')) LIKE ${deps.pushParam(params, `%${rawValue.toLowerCase()}%`)}`;
    }
    if (filter.operator === 'in' && Array.isArray(filter.value)) {
      const placeholders = filter.value.map((item) => deps.pushParam(params, deps.toText(item)));
      return `${column}::text IN (${placeholders.join(', ')})`;
    }
    return `DATE(${column}) = ${placeholder}::date`;
  }

  if (filter.operator === 'in' && Array.isArray(filter.value)) {
    const placeholders = filter.value.map((item) => deps.pushParam(params, deps.toText(item).toLowerCase()));
    return `LOWER(COALESCE(${column}::text, '')) IN (${placeholders.join(', ')})`;
  }

  const value = Array.isArray(filter.value) ? deps.toText(filter.value[0]) : deps.toText(filter.value);
  if (filter.operator === 'contains') {
    return `LOWER(COALESCE(${column}::text, '')) LIKE ${deps.pushParam(params, `%${value.toLowerCase()}%`)}`;
  }
  if (filter.operator === 'gte') {
    return `LOWER(COALESCE(${column}::text, '')) >= ${deps.pushParam(params, value.toLowerCase())}`;
  }
  if (filter.operator === 'lte') {
    return `LOWER(COALESCE(${column}::text, '')) <= ${deps.pushParam(params, value.toLowerCase())}`;
  }
  return `LOWER(COALESCE(${column}::text, '')) = ${deps.pushParam(params, value.toLowerCase())}`;
}

export function buildWhereClauseRuntime(
  params: unknown[],
  ctx: OttoAuthContext,
  plan: OttoToolInput,
  deps: QueryRuntimeDeps,
): string {
  const clauses: string[] = [buildTravelReportVisibilityClause(params, ctx)];

  if (plan.scope === 'mine') {
    clauses.push(buildTravelReportOwnerClause(params, ctx.requestUserId));
  } else if (plan.scope === 'team') {
    clauses.push(buildTravelReportOwnerClause(params, ctx.requestUserId));
  }

  if (plan.dateFrom) {
    clauses.push(`DATE("${plan.dateField}") >= ${deps.pushParam(params, plan.dateFrom)}::date`);
  }
  if (plan.dateTo) {
    clauses.push(`DATE("${plan.dateField}") <= ${deps.pushParam(params, plan.dateTo)}::date`);
  }

  for (const filter of plan.filters) {
    const clause = buildFilterClause(params, filter, deps);
    if (clause) {
      clauses.push(clause);
    }
  }

  const searchDocument = buildSearchDocumentSql();
  for (const term of plan.searchTerms) {
    clauses.push(`${searchDocument} LIKE ${deps.pushParam(params, `%${term.toLowerCase()}%`)}`);
  }

  if (typeof plan.amountMin === 'number' && Number.isFinite(plan.amountMin)) {
    clauses.push(`${METRIC_TO_SQL.grossamount} >= ${deps.pushParam(params, plan.amountMin)}`);
  }
  if (typeof plan.amountMax === 'number' && Number.isFinite(plan.amountMax)) {
    clauses.push(`${METRIC_TO_SQL.grossamount} <= ${deps.pushParam(params, plan.amountMax)}`);
  }

  return clauses.join(' AND ');
}

export function normalizePlanForAccessRuntime(plan: OttoToolInput, ctx: OttoAuthContext): OttoToolInput {
  if (ctx.canViewAll) {
    if (plan.scope === 'team') {
      return {
        ...plan,
        scope: 'mine',
      };
    }
    return plan;
  }

  return {
    ...plan,
    scope: 'mine',
  };
}
