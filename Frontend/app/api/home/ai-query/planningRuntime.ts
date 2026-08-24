import { buildPlannerPrompt } from './prompts';
import { applyQuestionHeuristics, maybeApplyMonthRange } from './planningHeuristics';
import {
  BOOKING_CODE_HINTS,
  DEFAULT_TOOL_INPUT,
  FIELD_DEFINITIONS,
  STATUS_NORMALIZERS,
  STOP_TERMS,
  VALUE_HINT_FIELDS,
} from './ottoSchema';
import { isDateField, isGroupField, isOttoField, isSortField } from './queryRuntime';
import type {
  OttoField,
  OttoFilter,
  OttoFilterOperator,
  OttoMetric,
  OttoRuntimeMetadata,
  OttoToolInput,
} from './ottoVTrAllTool';

interface PlanningDeps {
  callChatCompletion: (
    config: { baseUrl: string; apiKey: string; model: string },
    messages: Array<{ role: 'system' | 'user'; content: string }>,
    maxTokens: number,
  ) => Promise<string>;
  extractJsonObject: (raw: string) => string;
  toText: (value: unknown) => string;
  toLowerText: (value: unknown) => string;
  toFiniteNumber: (value: unknown) => number;
}

function isMetric(value: string): value is OttoMetric {
  return (
    value === 'grossamount' ||
    value === 'totalnetamount' ||
    value === 'taxamount' ||
    value === 'tr_amount' ||
    value === 'invoice_count' ||
    value === 'reimbursement_count' ||
    value === 'line_count'
  );
}

function normalizeLanguage(question: string, value: unknown, deps: PlanningDeps): 'zh' | 'en' {
  const text = deps.toLowerText(value);
  if (text === 'en') {
    return 'en';
  }
  return /[\u4e00-\u9fff]/.test(question) ? 'zh' : 'en';
}

function normalizeDateString(value: unknown, deps: PlanningDeps): string | null {
  const text = deps.toText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function clampLimit(value: unknown, fallback: number, deps: PlanningDeps): number {
  const numberValue = Math.trunc(deps.toFiniteNumber(value));
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return fallback;
  }
  return Math.max(1, Math.min(numberValue, 20));
}

function normalizeBoolean(value: unknown, deps: PlanningDeps): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  const text = deps.toLowerText(value);
  if (text === 'true' || text === 'yes' || text === '1') {
    return true;
  }
  if (text === 'false' || text === 'no' || text === '0') {
    return false;
  }
  return null;
}

function resolveStatusNormalizer(field: OttoField): Map<string, string> | null {
  if (field === 'approvalstatus') {
    return STATUS_NORMALIZERS.approval;
  }
  if (field === 'bookingstatus') {
    return STATUS_NORMALIZERS.booking;
  }
  if (field === 'invoice_status') {
    return STATUS_NORMALIZERS.invoice;
  }
  return null;
}

function normalizeStatusText(field: OttoField, value: string): string {
  const text = value.trim();
  if (!text) {
    return text;
  }
  const normalizer = resolveStatusNormalizer(field);
  if (!normalizer) {
    return text;
  }
  const lowered = text.toLowerCase();
  for (const [needle, normalizedValue] of normalizer.entries()) {
    const normalizedNeedle = needle.toLowerCase();
    if (lowered === normalizedNeedle || lowered.includes(normalizedNeedle) || normalizedNeedle.includes(lowered)) {
      return normalizedValue;
    }
  }
  return text;
}

function normalizeFilter(raw: unknown, deps: PlanningDeps): OttoFilter | null {
  const input = (raw ?? {}) as Record<string, unknown>;
  const field = deps.toText(input.field);
  const operator = deps.toText(input.operator) as OttoFilterOperator;
  if (!isOttoField(field)) {
    return null;
  }
  const definition = FIELD_DEFINITIONS[field];
  if (!['eq', 'contains', 'in', 'gte', 'lte', 'is_null', 'not_null'].includes(operator)) {
    return null;
  }

  if (operator === 'is_null' || operator === 'not_null') {
    return { field, operator };
  }

  let value: OttoFilter['value'] | undefined = input.value as OttoFilter['value'] | undefined;
  if (definition.type === 'boolean') {
    const normalized = Array.isArray(value)
      ? value.map((item) => normalizeBoolean(item, deps)).filter((item): item is boolean => item !== null)
      : normalizeBoolean(value, deps);
    if (normalized === null || (Array.isArray(normalized) && normalized.length === 0)) {
      return null;
    }
    value = normalized;
  } else if (definition.type === 'number') {
    if (Array.isArray(value)) {
      const normalized = value.map((item) => deps.toFiniteNumber(item)).filter((item) => Number.isFinite(item));
      if (normalized.length === 0) {
        return null;
      }
      value = normalized;
    } else {
      const normalized = deps.toFiniteNumber(value);
      if (!Number.isFinite(normalized)) {
        return null;
      }
      value = normalized;
    }
  } else {
    if (Array.isArray(value)) {
      const normalized = value
        .map((item) => normalizeStatusText(field, deps.toText(item)))
        .filter(Boolean);
      if (normalized.length === 0) {
        return null;
      }
      value = normalized;
    } else {
      const normalized = normalizeStatusText(field, deps.toText(value));
      if (!normalized && operator !== 'eq') {
        return null;
      }
      value = normalized;
    }
  }

  return { field, operator, value };
}

function normalizeSearchTerms(value: unknown, deps: PlanningDeps): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const terms = value
    .map((item) => deps.toText(item))
    .filter(Boolean)
    .map((item) => item.slice(0, 80))
    .filter((item, index, array) => array.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index);
  return terms.slice(0, 6);
}

function sanitizeSearchTerms(question: string, terms: string[]): string[] {
  const compactQuestion = question.replace(/\s+/g, '').toLowerCase();
  return terms.filter((term) => {
    const compact = term.replace(/\s+/g, '').toLowerCase();
    if (!compact || compact === compactQuestion) {
      return false;
    }
    if (compact.length > 24) {
      return false;
    }
    if (/^[0-9一二三四五六七八九十两]*[张条笔个]?发票$/.test(term)) {
      return false;
    }
    if (/^[0-9一二三四五六七八九十两]*[张条笔个]?报销(单|明细)?$/.test(term)) {
      return false;
    }
    if (/^(booking|code|approval|wait|for)$/i.test(term)) {
      return false;
    }
    if (/(多少|列出|统计|本月|这个月|上个月|去年|今年|我的|最近|最新|排行|排名|按|总额|金额|记录|明细|一共|哪些|什么)/.test(term)) {
      return false;
    }
    return true;
  });
}

function dedupeFilters(filters: OttoFilter[]): OttoFilter[] {
  const exactKeys = new Set(
    filters
      .filter((filter) => filter.operator === 'eq')
      .map((filter) => `${filter.field}|${JSON.stringify(filter.value)}`),
  );
  const seen = new Set<string>();
  return filters.filter((filter) => {
    if (filter.operator === 'contains' && exactKeys.has(`${filter.field}|${JSON.stringify(filter.value)}`)) {
      return false;
    }
    const key = JSON.stringify(filter);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeToolInput(question: string, value: unknown, deps: PlanningDeps): OttoToolInput {
  const input = (value ?? {}) as Record<string, unknown>;
  const groupByText = deps.toText(input.groupBy);
  const dateFieldText = deps.toText(input.dateField);
  const sortByText = deps.toText(input.sortBy);
  const metricText = deps.toText(input.metric);
  const filters = Array.isArray(input.filters)
    ? input.filters.map((item) => normalizeFilter(item, deps)).filter((item): item is OttoFilter => Boolean(item))
    : [];

  return {
    language: normalizeLanguage(question, input.language, deps),
    operation: input.operation === 'records' || input.operation === 'grouped' ? input.operation : 'summary',
    metric: isMetric(metricText) ? metricText : 'grossamount',
    scope: input.scope === 'team' || input.scope === 'allVisible' ? input.scope : 'mine',
    groupBy: isGroupField(groupByText) ? groupByText : null,
    dateField: isDateField(dateFieldText) ? dateFieldText : 'invoicedate',
    dateFrom: normalizeDateString(input.dateFrom, deps),
    dateTo: normalizeDateString(input.dateTo, deps),
    filters,
    searchTerms: normalizeSearchTerms(input.searchTerms, deps),
    sortBy: isSortField(sortByText) ? sortByText : 'metric',
    sortDirection: deps.toLowerText(input.sortDirection) === 'asc' ? 'asc' : 'desc',
    limit: clampLimit(input.limit, 8, deps),
    amountMin: input.amountMin === null || input.amountMin === undefined ? null : deps.toFiniteNumber(input.amountMin),
    amountMax: input.amountMax === null || input.amountMax === undefined ? null : deps.toFiniteNumber(input.amountMax),
  };
}


function collectMentionedFilters(question: string, metadata: OttoRuntimeMetadata): OttoFilter[] {
  const filters: OttoFilter[] = [];
  const lowered = question.toLowerCase();

  for (const [field, normalizer] of Object.entries(STATUS_NORMALIZERS)) {
    for (const [needle, value] of normalizer.entries()) {
      if (!lowered.includes(needle.toLowerCase())) {
        continue;
      }
      if (field === 'approval') {
        filters.push({ field: 'approvalstatus', operator: 'eq', value });
      } else if (field === 'booking') {
        filters.push({ field: 'bookingstatus', operator: 'eq', value });
      } else {
        filters.push({ field: 'invoice_status', operator: 'eq', value });
      }
      break;
    }
  }

  for (const field of VALUE_HINT_FIELDS) {
    const values = metadata.topValues[field] ?? [];
    for (const item of values) {
      if (!item.value) {
        continue;
      }
      if (question.toLowerCase().includes(item.value.toLowerCase())) {
        const operator: OttoFilterOperator = field === 'bookingcode' || field === 'currency' ? 'eq' : 'contains';
        filters.push({ field, operator, value: item.value });
      }
    }
  }

  const bookingCodeMatches = question.match(/\b[A-Z]{4}\b/g) ?? [];
  for (const code of bookingCodeMatches) {
    filters.push({ field: 'bookingcode', operator: 'eq', value: code });
  }

  for (const hint of BOOKING_CODE_HINTS) {
    if (hint.aliases.some((alias) => lowered.includes(alias.toLowerCase()))) {
      filters.push({ field: 'bookingcode', operator: 'eq', value: hint.code });
    }
  }

  return dedupeFilters(filters);
}

function extractSearchTerms(question: string): string[] {
  const matched = question
    .replace(/[，。！？,.!?()（）]/g, ' ')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !STOP_TERMS.has(item.toLowerCase()))
    .filter((item) => !/^20\d{2}(-\d{2}){0,2}$/.test(item));

  const unique = matched.filter((item, index, array) => array.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index);
  return sanitizeSearchTerms(question, unique.slice(0, 4));
}

export function buildFallbackToolInputRuntime(question: string, metadata: OttoRuntimeMetadata): OttoToolInput {
  const plan: OttoToolInput = {
    ...DEFAULT_TOOL_INPUT,
    language: /[\u4e00-\u9fff]/.test(question) ? 'zh' : 'en',
    filters: collectMentionedFilters(question, metadata),
    searchTerms: [],
  };

  if (/(列出|list|show|最新|最近|latest|recent|明细|记录)/i.test(question)) {
    plan.operation = 'records';
    plan.limit = 6;
  }

  if (/(按|统计|排行|排名|top|breakdown|compare|比较|最高|最大|分布|谁的)/i.test(question)) {
    plan.operation = 'grouped';
  }

  if (/(谁|申请人|报销人|applicant|employee)/i.test(question) && plan.operation === 'grouped') {
    plan.groupBy = 'tr_user_name';
  } else if (/(项目经理|project manager)/i.test(question) && plan.operation === 'grouped') {
    plan.groupBy = 'project_manager_name';
  } else if (/(审批人|approver)/i.test(question) && plan.operation === 'grouped') {
    plan.groupBy = 'approver_name';
  } else if (/(项目|project)/i.test(question) && plan.operation === 'grouped') {
    plan.groupBy = 'project_description';
  } else if (/(客户|customer)/i.test(question) && plan.operation === 'grouped') {
    plan.groupBy = 'customername';
  } else if (/(供应商|vendor|supplier|商家)/i.test(question) && plan.operation === 'grouped') {
    plan.groupBy = 'invoice_supplier';
  } else if (/(目的地|城市|destination|travel destination)/i.test(question) && plan.operation === 'grouped') {
    plan.groupBy = 'travel_destination';
  } else if (/(费用说明|描述|description)/i.test(question) && plan.operation === 'grouped') {
    plan.groupBy = 'invoice_description';
  } else if (/(记账码|booking code|类别|分类)/i.test(question) && plan.operation === 'grouped') {
    plan.groupBy = 'bookingcode';
  } else if (/(审批状态|approval status)/i.test(question) && plan.operation === 'grouped') {
    plan.groupBy = 'approvalstatus';
  } else if (/(记账状态|booking status|财务状态)/i.test(question) && plan.operation === 'grouped') {
    plan.groupBy = 'bookingstatus';
  } else if (/(发票状态|invoice status)/i.test(question) && plan.operation === 'grouped') {
    plan.groupBy = 'invoice_status';
  }

  if (/(税额|tax)/i.test(question)) {
    plan.metric = 'taxamount';
  } else if (/(未税|净额|net)/i.test(question)) {
    plan.metric = 'totalnetamount';
  } else if (/(报销行|line amount|tr amount)/i.test(question)) {
    plan.metric = 'tr_amount';
  } else if (/(报销单数|几张报销单|多少报销单|reimbursement count)/i.test(question)) {
    plan.metric = 'reimbursement_count';
  } else if (/(几张发票|多少发票|invoice count|count)/i.test(question)) {
    plan.metric = 'invoice_count';
  }

  if (/(我的|我自己|my\b)/i.test(question)) {
    plan.scope = 'mine';
  }
  if (/(团队|team)/i.test(question)) {
    plan.scope = 'team';
  }
  if (/(全部|所有|all visible|overall)/i.test(question)) {
    plan.scope = 'allVisible';
  }

  maybeApplyMonthRange(question, plan);

  const terms = extractSearchTerms(question);
  const filterValues = new Set(plan.filters.map((item) => String(Array.isArray(item.value) ? item.value.join(' ') : item.value ?? '').toLowerCase()));
  plan.searchTerms = sanitizeSearchTerms(question, terms.filter((item) => !filterValues.has(item.toLowerCase())));

  if (/(最高|最大|top|排行|排名)/i.test(question)) {
    plan.sortDirection = 'desc';
    plan.sortBy = 'metric';
    plan.limit = Math.min(plan.limit, 5);
    if (plan.operation !== 'records') {
      plan.operation = 'grouped';
    }
  }

  if (plan.operation === 'grouped' && !plan.groupBy) {
    plan.groupBy = 'project_description';
  }

  return applyQuestionHeuristics(question, plan);
}

export async function planToolInputRuntime(
  question: string,
  metadata: OttoRuntimeMetadata,
  llm: { baseUrl: string; apiKey: string; model: string } | null,
  deps: PlanningDeps,
): Promise<OttoToolInput> {
  if (!llm) {
    return buildFallbackToolInputRuntime(question, metadata);
  }

  try {
    const raw = await deps.callChatCompletion(
      llm,
      [
        { role: 'system', content: buildPlannerPrompt(metadata) },
        { role: 'user', content: question },
      ],
      800,
    );
    const jsonText = deps.extractJsonObject(raw);
    if (!jsonText) {
      return buildFallbackToolInputRuntime(question, metadata);
    }
    const normalized = normalizeToolInput(question, JSON.parse(jsonText), deps);
    const merged: OttoToolInput = {
      ...normalized,
      searchTerms: sanitizeSearchTerms(question, normalized.searchTerms),
      filters: dedupeFilters([...normalized.filters, ...collectMentionedFilters(question, metadata)]),
    };
    if (merged.searchTerms.length === 0) {
      merged.searchTerms = extractSearchTerms(question).filter((term) => term.length > 1);
    }
    if (merged.operation === 'grouped' && !merged.groupBy) {
      merged.groupBy = 'project_description';
    }
    return applyQuestionHeuristics(question, merged);
  } catch {
    return buildFallbackToolInputRuntime(question, metadata);
  }
}
