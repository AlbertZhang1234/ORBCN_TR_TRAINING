import { getLlmConfig } from '../../home/ai-query/ottoVTrAllTool';
import { loadRuntimeMetadataRuntime } from '../../home/ai-query/metadataRuntime';
import type { OttoRuntimeMetadata } from '../../home/ai-query/ottoVTrAllTool';
import type { TravelReportAccessContext } from '../../../../services/TravelReport/server';
import {
  getTrReportAiFieldLabel,
  isTrReportAiFieldId,
  TR_REPORT_AI_DEFAULT_PLAN,
  TR_REPORT_AI_FIELD_CATALOG,
  TR_REPORT_AI_TOOL_NAME,
  type TrReportAiPlan,
  type TrReportAiResult,
  type TrReportAiStage,
  type TrReportAiValueConfig,
} from '../../../../services/TravelReport/pivotAi';

interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

interface TrReportAiProgressEvent {
  stage: TrReportAiStage;
  message: string;
  detail?: string;
  timestamp: string;
}

interface TrReportAiRunOptions {
  onProgress?: (event: TrReportAiProgressEvent) => void;
}

interface RawPlannerPayload {
  language?: unknown;
  summary?: unknown;
  layout?: {
    rows?: unknown;
    columns?: unknown;
    filters?: unknown;
    values?: unknown;
  };
  filterSelections?: unknown;
  showGrandTotal?: unknown;
}

const APPROVAL_STATUS_CANONICAL: Record<string, string> = {
  approved: 'APPROVED',
  '已通过': 'APPROVED',
  通过: 'APPROVED',
  reject: 'REJECTED',
  rejected: 'REJECTED',
  拒绝: 'REJECTED',
  驳回: 'REJECTED',
  pending: 'Wait for Approval',
  waiting: 'Wait for Approval',
  'wait for approval': 'Wait for Approval',
  待审批: 'Wait for Approval',
  审批中: 'Wait for Approval',
  没审批完: 'Wait for Approval',
  未审批: 'Wait for Approval',
};

const BOOKING_STATUS_CANONICAL: Record<string, string> = {
  open: 'OPEN',
  booked: 'BOOKED',
  未记账: 'OPEN',
  待记账: 'OPEN',
  已记账: 'BOOKED',
};

const BOOKING_CODE_CANONICAL: Array<{ match: RegExp; value: string }> = [
  { match: /停车|park/i, value: 'PARK' },
  { match: /taxi|打车|出租车|网约车|代驾/i, value: 'TAXI' },
  { match: /高速|过路|过桥|etc|autg/i, value: 'AUTG' },
  { match: /加油|petrol|diesel|fuel|benl/i, value: 'BENL' },
  { match: /餐饮|工作餐|用餐|hospitality|meal|dining|bewi/i, value: 'BEWI' },
  { match: /其他|其它|others|sobe/i, value: 'SOBE' },
];

const DIMENSION_GROUP_DEFINITIONS = [
  { key: 'applicant', members: ['tr_userid', 'tr_user_name'] },
  { key: 'project', members: ['tr_projectid', 'project_description'] },
  { key: 'customer', members: ['customerid', 'customername'] },
  { key: 'project_manager', members: ['project_manager_userid', 'project_manager_name'] },
  { key: 'approver', members: ['approver_userid', 'approver_name'] },
  { key: 'invoice_user', members: ['invoice_userid', 'invoice_user_name'] },
] as const;

const FIELD_TO_GROUP_KEY = new Map(
  DIMENSION_GROUP_DEFINITIONS.flatMap((group) => group.members.map((fieldId) => [fieldId, group.key] as const)),
);

const COLUMN_FRIENDLY_FIELDS = new Set([
  'approvalstatus',
  'bookingstatus',
  'invoice_status',
  'currency',
  'tr_created_month',
  'invoicedate_month',
  'bookingcode',
  'tr_created_date',
  'invoicedate',
]);

interface DimensionGroup {
  key: string;
  members: string[];
  preferredAxis: 'rows' | 'columns';
}

function toText(value: unknown): string {
  return String(value ?? '').trim();
}

function toLowerText(value: unknown): string {
  return toText(value).toLowerCase();
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  const lowered = toLowerText(value);
  return lowered === 'true' || lowered === '1' || lowered === 'yes';
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => toText(item)).filter(Boolean)));
}

function emitProgress(
  onProgress: TrReportAiRunOptions['onProgress'] | undefined,
  stage: TrReportAiStage,
  message: string,
  detail?: string,
) {
  if (!onProgress) {
    return;
  }
  onProgress({
    stage,
    message,
    detail,
    timestamp: new Date().toISOString(),
  });
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  const blockMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (blockMatch?.[1]) {
    return blockMatch[1].trim();
  }
  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  return objectMatch?.[0]?.trim() ?? '';
}

async function callChatCompletion(
  config: LlmConfig,
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  maxTokens: number,
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.1,
      max_tokens: maxTokens,
      messages,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as ChatCompletionResponse;
  if (!response.ok) {
    throw new Error(toText(payload?.error?.message) || `LLM request failed (${response.status})`);
  }

  return toText(payload?.choices?.[0]?.message?.content);
}

function detectLanguage(question: string): 'zh' | 'en' {
  return /[\u4e00-\u9fff]/.test(question) ? 'zh' : 'en';
}

function buildFieldCatalogPrompt(): string {
  return TR_REPORT_AI_FIELD_CATALOG.map((item) => {
    const aggregations = item.allowedAggregations?.join(', ') ?? 'dimension-only';
    return `- ${item.id} [${item.type}]: ${item.role}; aliases=${item.aliases.join(', ')}; aggregations=${aggregations}`;
  }).join('\n');
}

function buildMetadataPrompt(metadata: OttoRuntimeMetadata): string {
  const lines: string[] = [];
  lines.push(`Visible rows=${metadata.summary.rowCount}, reimbursements=${metadata.summary.reimbursementCount}, invoices=${metadata.summary.invoiceCount}`);

  for (const item of TR_REPORT_AI_FIELD_CATALOG) {
    const values = metadata.topValues[item.id as keyof typeof metadata.topValues];
    if (!Array.isArray(values) || values.length === 0) {
      continue;
    }
    lines.push(`Top values for ${item.id}: ${values.map((entry) => `${entry.value} (${entry.count})`).join(', ')}`);
  }

  return lines.join('\n');
}

function buildPlannerPrompt(question: string, metadata: OttoRuntimeMetadata, access: TravelReportAccessContext): string {
  const today = new Date().toISOString().slice(0, 10);
  const language = detectLanguage(question);

  return [
    `You are planning arguments for the ${TR_REPORT_AI_TOOL_NAME} tool.`,
    `Today is ${today}.`,
    `Current user id is ${access.requesterUserId}.`,
    `Current user can view all visible data = ${access.canViewAll ? 'true' : 'false'}.`,
    `Reply language should be ${language}.`,
    'The tool configures a local pivot table. It does not write SQL and it does not mutate UI directly.',
    'Return JSON only. Never explain outside JSON.',
    'Field catalog:',
    buildFieldCatalogPrompt(),
    '',
    'Runtime value hints:',
    buildMetadataPrompt(metadata),
    '',
    'Return exactly this JSON shape:',
    '{"language":"zh|en","summary":"short one-line description","layout":{"rows":["fieldId"],"columns":["fieldId"],"filters":["fieldId"],"values":[{"fieldId":"grossamount","aggregation":"sum|count|avg|min|max"}]},"filterSelections":{"fieldId":["exact values already visible in the pivot filters"]},"showGrandTotal":true}',
    'Rules:',
    '- Use only field IDs from the catalog.',
    '- For amount totals use grossamount sum unless the user clearly asks for tax, net, reimbursement amount, average, min or max.',
    '- For count-style questions, use tr_id with aggregation=count.',
    '- Think in three buckets: dimensions, measures and exact filters. Dimensions go to rows or columns, measures go to values, exact constraints go to filterSelections.',
    '- For project analysis, rows should usually include tr_projectid and project_description together.',
    '- For applicant analysis, rows should usually include tr_userid and tr_user_name together.',
    '- For customer analysis, rows should usually include customerid and customername together.',
    '- Keep paired ID/name fields together in the same axis.',
    '- When there are two or more dimension groups, distribute them across rows and columns instead of stacking everything into rows.',
    '- Status, month, date bucket, booking code and currency are usually clearer in columns when another entity dimension is already on rows.',
    '- When the user asks by month, use tr_created_month only if they explicitly say created/submitted month; otherwise prefer invoicedate_month.',
    '- approvalstatus canonical values are APPROVED, REJECTED, Wait for Approval.',
    '- bookingstatus canonical values are OPEN, BOOKED.',
    '- bookingcode canonical values are PARK, TAXI, AUTG, BENL, BEWI, SOBE.',
    '- If the user says 我/我的/my and the user can view all data, add a filterSelection for tr_userid using the current user id.',
    '- Put exact filter values only in filterSelections. If a value is unclear, leave it out and express the broad dimension in rows/columns/filters instead.',
    '- Avoid placing the same field in multiple zones.',
    '- Keep the plan compact. Usually rows 0-3, columns 0-2, filters 0-4, values 1-2.',
  ].join('\n');
}

function normalizeAggregation(value: unknown): 'sum' | 'count' | 'avg' | 'min' | 'max' {
  const lowered = toLowerText(value);
  if (lowered === 'count' || lowered === 'avg' || lowered === 'min' || lowered === 'max') {
    return lowered;
  }
  return 'sum';
}

function matchTopValue(fieldId: string, rawValue: string, metadata: OttoRuntimeMetadata): string {
  const values = metadata.topValues[fieldId as keyof typeof metadata.topValues];
  if (!Array.isArray(values) || values.length === 0) {
    return rawValue;
  }

  const lowered = rawValue.toLowerCase();
  const exact = values.find((item) => item.value.toLowerCase() === lowered);
  if (exact) {
    return exact.value;
  }

  const contains = values.find((item) => item.value.toLowerCase().includes(lowered) || lowered.includes(item.value.toLowerCase()));
  return contains?.value ?? rawValue;
}

function canonicalizeFilterValue(fieldId: string, rawValue: string, metadata: OttoRuntimeMetadata): string {
  const text = toText(rawValue);
  if (!text) {
    return '';
  }
  const lowered = text.toLowerCase();

  if (fieldId === 'approvalstatus') {
    return matchTopValue(fieldId, APPROVAL_STATUS_CANONICAL[lowered] ?? text, metadata);
  }
  if (fieldId === 'bookingstatus') {
    return matchTopValue(fieldId, BOOKING_STATUS_CANONICAL[lowered] ?? text.toUpperCase(), metadata);
  }
  if (fieldId === 'bookingcode') {
    const mapped = BOOKING_CODE_CANONICAL.find((item) => item.match.test(text))?.value ?? text.toUpperCase();
    return matchTopValue(fieldId, mapped, metadata);
  }
  if (fieldId === 'currency') {
    return matchTopValue(fieldId, text.toUpperCase(), metadata);
  }
  if (fieldId === 'tr_created_month' || fieldId === 'invoicedate_month') {
    const monthMatch = text.match(/(20\d{2})[-\/年](0?[1-9]|1[0-2])/);
    if (monthMatch) {
      return `${monthMatch[1]}-${monthMatch[2].padStart(2, '0')}`;
    }
    return text;
  }
  if (fieldId === 'tr_created_date' || fieldId === 'invoicedate' || fieldId === 'travel_fromdate' || fieldId === 'travel_todate') {
    const dateMatch = text.match(/(20\d{2})[-\/年](0?[1-9]|1[0-2])[-\/月](0?[1-9]|[12]\d|3[01])/);
    if (dateMatch) {
      return `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
    }
    return text;
  }

  return matchTopValue(fieldId, text, metadata);
}

function sanitizeValueConfigs(rawValues: unknown): TrReportAiValueConfig[] {
  if (!Array.isArray(rawValues)) {
    return [...TR_REPORT_AI_DEFAULT_PLAN.values];
  }

  const nextValues: TrReportAiValueConfig[] = [];
  for (const item of rawValues) {
    const fieldId = isTrReportAiFieldId(toText((item as { fieldId?: unknown })?.fieldId))
      ? toText((item as { fieldId?: unknown })?.fieldId)
      : '';
    if (!fieldId) {
      continue;
    }
    nextValues.push({
      fieldId,
      aggregation: normalizeAggregation((item as { aggregation?: unknown })?.aggregation),
    });
  }

  return nextValues.length > 0 ? nextValues : [...TR_REPORT_AI_DEFAULT_PLAN.values];
}

function sanitizeZone(rawValue: unknown, occupied: Set<string>): string[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  const nextValues: string[] = [];
  for (const item of rawValue) {
    const fieldId = toText(item);
    if (!isTrReportAiFieldId(fieldId) || occupied.has(fieldId)) {
      continue;
    }
    occupied.add(fieldId);
    nextValues.push(fieldId);
  }
  return nextValues;
}

function sanitizeFilterSelections(
  rawValue: unknown,
  metadata: OttoRuntimeMetadata,
): Record<string, string[]> {
  if (!rawValue || typeof rawValue !== 'object') {
    return {};
  }

  const nextSelections: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(rawValue as Record<string, unknown>)) {
    const fieldId = toText(key);
    if (!isTrReportAiFieldId(fieldId) || !Array.isArray(value)) {
      continue;
    }
    const values = uniq(
      value
        .map((item) => canonicalizeFilterValue(fieldId, toText(item), metadata))
        .filter(Boolean),
    );
    if (values.length > 0) {
      nextSelections[fieldId] = values;
    }
  }
  return nextSelections;
}

function sanitizePlanPayload(raw: RawPlannerPayload, metadata: OttoRuntimeMetadata): TrReportAiPlan {
  const occupied = new Set<string>();
  const rows = sanitizeZone(raw.layout?.rows, occupied);
  const columns = sanitizeZone(raw.layout?.columns, occupied);
  const filters = sanitizeZone(raw.layout?.filters, occupied);
  const values = sanitizeValueConfigs(raw.layout?.values);
  const filterSelections = sanitizeFilterSelections(raw.filterSelections, metadata);

  Object.keys(filterSelections).forEach((fieldId) => {
    const rowIndex = rows.indexOf(fieldId);
    if (rowIndex >= 0) {
      rows.splice(rowIndex, 1);
    }
    const columnIndex = columns.indexOf(fieldId);
    if (columnIndex >= 0) {
      columns.splice(columnIndex, 1);
    }
    if (!filters.includes(fieldId)) {
      filters.push(fieldId);
    }
    occupied.add(fieldId);
  });

  return {
    rows,
    columns,
    filters,
    values,
    filterSelections,
    showGrandTotal: raw.showGrandTotal == null ? true : toBoolean(raw.showGrandTotal),
  };
}

function groupLayoutDimensions(rows: string[], columns: string[]): DimensionGroup[] {
  const orderedFields = [
    ...rows.map((fieldId) => ({ fieldId })),
    ...columns.map((fieldId) => ({ fieldId })),
  ];
  const seenGroups = new Set<string>();
  const seenFields = new Set<string>();
  const groups: DimensionGroup[] = [];

  for (const item of orderedFields) {
    if (seenFields.has(item.fieldId)) {
      continue;
    }

    const groupKey = FIELD_TO_GROUP_KEY.get(item.fieldId);
    if (groupKey) {
      if (seenGroups.has(groupKey)) {
        continue;
      }
      const groupDefinition = DIMENSION_GROUP_DEFINITIONS.find((entry) => entry.key === groupKey);
      if (!groupDefinition) {
        continue;
      }
      const members = groupDefinition.members.filter((fieldId) => rows.includes(fieldId) || columns.includes(fieldId));
      if (members.length === 0) {
        continue;
      }
      members.forEach((fieldId) => seenFields.add(fieldId));
      seenGroups.add(groupKey);
      groups.push({
        key: groupKey,
        members,
        preferredAxis: members.some((fieldId) => COLUMN_FRIENDLY_FIELDS.has(fieldId)) ? 'columns' : 'rows',
      });
      continue;
    }

    seenFields.add(item.fieldId);
    groups.push({
      key: item.fieldId,
      members: [item.fieldId],
      preferredAxis: COLUMN_FRIENDLY_FIELDS.has(item.fieldId) ? 'columns' : 'rows',
    });
  }

  return groups;
}

function rebalancePlanDimensions(plan: TrReportAiPlan): TrReportAiPlan {
  const groups = groupLayoutDimensions(plan.rows, plan.columns);
  if (groups.length === 0) {
    return {
      ...plan,
      rows: [],
      columns: [],
    };
  }

  if (groups.length === 1) {
    return {
      ...plan,
      rows: [...groups[0].members],
      columns: [],
    };
  }

  const targetColumnGroupCount = groups.length === 2 ? 1 : Math.min(2, Math.floor(groups.length / 2));
  const columnGroupKeys = new Set<string>();

  for (const group of groups) {
    if (columnGroupKeys.size >= targetColumnGroupCount) {
      break;
    }
    if (group.preferredAxis === 'columns') {
      columnGroupKeys.add(group.key);
    }
  }

  for (let index = groups.length - 1; index >= 0 && columnGroupKeys.size < targetColumnGroupCount; index -= 1) {
    columnGroupKeys.add(groups[index].key);
  }

  let nextRows = groups.filter((group) => !columnGroupKeys.has(group.key)).flatMap((group) => group.members);
  let nextColumns = groups.filter((group) => columnGroupKeys.has(group.key)).flatMap((group) => group.members);

  if (nextRows.length === 0) {
    const firstColumnGroup = groups.find((group) => columnGroupKeys.has(group.key));
    if (firstColumnGroup) {
      columnGroupKeys.delete(firstColumnGroup.key);
      nextRows = firstColumnGroup.members;
      nextColumns = groups.filter((group) => columnGroupKeys.has(group.key)).flatMap((group) => group.members);
    }
  }

  if (nextColumns.length === 0 && groups.length > 1) {
    const fallbackColumnGroup = groups[groups.length - 1];
    nextRows = groups.slice(0, -1).flatMap((group) => group.members);
    nextColumns = [...fallbackColumnGroup.members];
  }

  return {
    ...plan,
    rows: nextRows,
    columns: nextColumns,
  };
}

function parseMonthValue(question: string): string | null {
  const match = question.match(/(20\d{2})[-\/年](0?[1-9]|1[0-2])/);
  if (!match) {
    return null;
  }
  return `${match[1]}-${match[2].padStart(2, '0')}`;
}

function parseDateValue(question: string): string | null {
  const match = question.match(/(20\d{2})[-\/年](0?[1-9]|1[0-2])[-\/月](0?[1-9]|[12]\d|3[01])/);
  if (!match) {
    return null;
  }
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

function includesAny(question: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(question));
}

function buildHeuristicPlan(question: string, access: TravelReportAccessContext): TrReportAiPlan {
  const lowered = question.toLowerCase();
  const rows: string[] = [];
  const columns: string[] = [];
  const filters: string[] = [];
  const filterSelections: Record<string, string[]> = {};

  const pushRow = (...fieldIds: string[]) => {
    for (const fieldId of fieldIds) {
      if (!rows.includes(fieldId) && !columns.includes(fieldId) && !filters.includes(fieldId)) {
        rows.push(fieldId);
      }
    }
  };
  const pushColumn = (fieldId: string) => {
    if (!rows.includes(fieldId) && !columns.includes(fieldId) && !filters.includes(fieldId)) {
      columns.push(fieldId);
    }
  };
  const pushFilter = (fieldId: string, values?: string[]) => {
    const rowIndex = rows.indexOf(fieldId);
    if (rowIndex >= 0) {
      rows.splice(rowIndex, 1);
    }
    const columnIndex = columns.indexOf(fieldId);
    if (columnIndex >= 0) {
      columns.splice(columnIndex, 1);
    }
    if (!filters.includes(fieldId)) {
      filters.push(fieldId);
    }
    if (Array.isArray(values) && values.length > 0) {
      filterSelections[fieldId] = uniq(values);
    }
  };

  if (includesAny(lowered, [/项目/, /project/])) {
    pushRow('tr_projectid', 'project_description');
  }
  if (includesAny(lowered, [/申请人/, /报销人/, /员工/, /\bwho\b/, /applicant/, /employee/])) {
    pushRow('tr_userid', 'tr_user_name');
  }
  if (includesAny(lowered, [/客户/, /customer/])) {
    pushRow('customerid', 'customername');
  }
  if (includesAny(lowered, [/供应商/, /商家/, /vendor/, /supplier/])) {
    pushRow('invoice_supplier');
  }
  if (includesAny(lowered, [/目的地/, /城市/, /destination/, /\bcity\b/])) {
    pushRow('travel_destination');
  }
  if (includesAny(lowered, [/项目经理/, /project manager/, /\bpm\b/])) {
    pushRow('project_manager_name');
  }
  if (includesAny(lowered, [/审批人/, /approver/])) {
    pushRow('approver_name');
  }
  if (includesAny(lowered, [/费用类别/, /费用类型/, /发票类型/, /booking code/, /expense type/, /category/, /停车/, /高速/, /打车/, /加油/, /餐饮/])) {
    pushRow('bookingcode');
  }

  const monthField = includesAny(lowered, [/创建月/, /提交月/, /created month/, /submission month/])
    ? 'tr_created_month'
    : 'invoicedate_month';
  const dateField = includesAny(lowered, [/创建日期/, /提交日期/, /created date/, /submission date/])
    ? 'tr_created_date'
    : 'invoicedate';

  if (includesAny(lowered, [/每月/, /按月/, /月份/, /month/])) {
    pushRow(monthField);
  }

  if (includesAny(lowered, [/审批状态/, /approval status/])) {
    if (rows.length > 0) {
      pushColumn('approvalstatus');
    } else {
      pushRow('approvalstatus');
    }
  }
  if (includesAny(lowered, [/记账状态/, /booking status/])) {
    if (rows.length > 0) {
      pushColumn('bookingstatus');
    } else {
      pushRow('bookingstatus');
    }
  }
  if (includesAny(lowered, [/发票状态/, /invoice status/])) {
    if (rows.length > 0) {
      pushColumn('invoice_status');
    } else {
      pushRow('invoice_status');
    }
  }
  if (includesAny(lowered, [/币种/, /currency/])) {
    if (rows.length > 0) {
      pushColumn('currency');
    } else {
      pushRow('currency');
    }
  }

  if (includesAny(lowered, [/我的/, /\bmy\b/, /^我/, /我自己/]) && access.canViewAll) {
    pushFilter('tr_userid', [access.requesterUserId]);
  }

  const monthValue = parseMonthValue(question);
  const dateValue = parseDateValue(question);
  if (monthValue) {
    pushFilter(monthField, [monthValue]);
  }
  if (dateValue) {
    pushFilter(dateField, [dateValue]);
  }

  const approvalValues: string[] = [];
  if (includesAny(lowered, [/已通过/, /approved/, /\bpass(ed)?\b/])) {
    approvalValues.push('APPROVED');
  }
  if (includesAny(lowered, [/驳回/, /拒绝/, /rejected?/])) {
    approvalValues.push('REJECTED');
  }
  if (includesAny(lowered, [/待审批/, /审批中/, /没审批完/, /waiting/, /pending/])) {
    approvalValues.push('Wait for Approval');
  }
  if (approvalValues.length > 0) {
    pushFilter('approvalstatus', approvalValues);
  }

  const bookingValues: string[] = [];
  if (includesAny(lowered, [/未记账/, /待记账/, /\bopen\b/])) {
    bookingValues.push('OPEN');
  }
  if (includesAny(lowered, [/已记账/, /\bbooked\b/])) {
    bookingValues.push('BOOKED');
  }
  if (bookingValues.length > 0) {
    pushFilter('bookingstatus', bookingValues);
  }

  const bookingCode = BOOKING_CODE_CANONICAL.find((item) => item.match.test(question))?.value;
  if (bookingCode) {
    pushFilter('bookingcode', [bookingCode]);
  }

  const currencyMatch = question.match(/\b(CNY|USD|EUR|HKD|JPY|SGD)\b/i);
  if (currencyMatch?.[1]) {
    pushFilter('currency', [currencyMatch[1].toUpperCase()]);
  }

  let valueFieldId = 'grossamount';
  let aggregation: TrReportAiValueConfig['aggregation'] = 'sum';
  if (includesAny(lowered, [/数量/, /多少/, /count/, /几笔/, /几单/])) {
    valueFieldId = 'tr_id';
    aggregation = 'count';
  } else if (includesAny(lowered, [/平均/, /avg/, /average/])) {
    aggregation = 'avg';
    if (includesAny(lowered, [/税/])) {
      valueFieldId = 'taxamount';
    } else if (includesAny(lowered, [/未税/, /净额/, /net/])) {
      valueFieldId = 'totalnetamount';
    } else if (includesAny(lowered, [/报销金额/, /报销行金额/, /reimbursement/])) {
      valueFieldId = 'tr_amount';
    }
  } else if (includesAny(lowered, [/税/])) {
    valueFieldId = 'taxamount';
  } else if (includesAny(lowered, [/未税/, /净额/, /net/])) {
    valueFieldId = 'totalnetamount';
  } else if (includesAny(lowered, [/报销金额/, /报销行金额/, /reimbursement/])) {
    valueFieldId = 'tr_amount';
  }

  return {
    rows,
    columns,
    filters,
    values: [{ fieldId: valueFieldId, aggregation }],
    filterSelections,
    showGrandTotal: true,
  };
}

async function planPivotToolInput(
  question: string,
  metadata: OttoRuntimeMetadata,
  access: TravelReportAccessContext,
  llm: LlmConfig | null,
): Promise<{ language: 'zh' | 'en'; summary: string; plan: TrReportAiPlan }> {
  const language = detectLanguage(question);
  const heuristicPlan = buildHeuristicPlan(question, access);

  if (!llm) {
    return {
      language,
      summary: language === 'zh' ? '已根据你的问题自动配置透视表。' : 'The pivot report has been configured from your request.',
      plan: heuristicPlan,
    };
  }

  try {
    const rawResponse = await callChatCompletion(
      llm,
      [
        {
          role: 'system',
          content: buildPlannerPrompt(question, metadata, access),
        },
        {
          role: 'user',
          content: question,
        },
      ],
      900,
    );
    const rawJson = extractJsonObject(rawResponse);
    const parsed = rawJson ? (JSON.parse(rawJson) as RawPlannerPayload) : {};
    return {
      language: toLowerText(parsed.language) === 'en' ? 'en' : language,
      summary:
        toText(parsed.summary) ||
        (language === 'zh' ? '已根据你的问题自动配置透视表。' : 'The pivot report has been configured from your request.'),
      plan: sanitizePlanPayload(parsed, metadata),
    };
  } catch {
    return {
      language,
      summary: language === 'zh' ? '已根据你的问题自动配置透视表。' : 'The pivot report has been configured from your request.',
      plan: heuristicPlan,
    };
  }
}

function ensureUsablePlan(plan: TrReportAiPlan): TrReportAiPlan {
  const nextPlan = rebalancePlanDimensions({
    rows: [...plan.rows],
    columns: [...plan.columns],
    filters: [...plan.filters],
    values: plan.values.length > 0 ? [...plan.values] : [...TR_REPORT_AI_DEFAULT_PLAN.values],
    filterSelections: { ...plan.filterSelections },
    showGrandTotal: plan.showGrandTotal,
  });

  const hasAnyLayout = nextPlan.rows.length > 0 || nextPlan.columns.length > 0 || nextPlan.filters.length > 0;
  if (!hasAnyLayout && Object.keys(nextPlan.filterSelections).length === 0) {
    return {
      ...TR_REPORT_AI_DEFAULT_PLAN,
      filterSelections: {},
    };
  }

  return nextPlan;
}

function formatValueSummary(value: TrReportAiValueConfig, language: 'zh' | 'en'): string {
  const fieldLabel = getTrReportAiFieldLabel(value.fieldId, language);
  const aggregationLabel =
    language === 'zh'
      ? value.aggregation === 'count'
        ? '计数'
        : value.aggregation === 'avg'
          ? '平均值'
          : value.aggregation === 'min'
            ? '最小值'
            : value.aggregation === 'max'
              ? '最大值'
              : '求和'
      : value.aggregation === 'count'
        ? 'count'
        : value.aggregation === 'avg'
          ? 'average'
          : value.aggregation === 'min'
            ? 'min'
            : value.aggregation === 'max'
              ? 'max'
              : 'sum';
  return language === 'zh' ? `${fieldLabel}（${aggregationLabel}）` : `${fieldLabel} (${aggregationLabel})`;
}

function formatZone(zone: string[], language: 'zh' | 'en'): string {
  if (zone.length === 0) {
    return language === 'zh' ? '无' : 'none';
  }
  return zone.map((fieldId) => getTrReportAiFieldLabel(fieldId, language)).join(language === 'zh' ? ' > ' : ' > ');
}

function formatFilterSelections(
  selections: Record<string, string[]>,
  language: 'zh' | 'en',
): string {
  const entries = Object.entries(selections);
  if (entries.length === 0) {
    return language === 'zh' ? '无' : 'none';
  }
  return entries
    .map(([fieldId, values]) => `${getTrReportAiFieldLabel(fieldId, language)} = ${values.join(', ')}`)
    .join(language === 'zh' ? '；' : '; ');
}

function buildAssistantMessage(
  question: string,
  summary: string,
  plan: TrReportAiPlan,
  language: 'zh' | 'en',
): string {
  if (language === 'en') {
    return [
      '### Applied Pivot Report',
      summary,
      '',
      `- Rows: ${formatZone(plan.rows, language)}`,
      `- Columns: ${formatZone(plan.columns, language)}`,
      `- Values: ${plan.values.map((item) => formatValueSummary(item, language)).join(', ')}`,
      `- Filters: ${formatZone(plan.filters, language)}`,
      `- Filter selections: ${formatFilterSelections(plan.filterSelections, language)}`,
      '',
      'The pivot table has been refreshed with this configuration. You can continue with follow-up requests such as "switch rows to applicant" or "only keep pending approvals".',
      '',
      `Original request: ${question}`,
    ].join('\n');
  }

  return [
    '### 已应用透视报表配置',
    summary,
    '',
    `- 行：${formatZone(plan.rows, language)}`,
    `- 列：${formatZone(plan.columns, language)}`,
    `- 值：${plan.values.map((item) => formatValueSummary(item, language)).join('，')}`,
    `- 过滤字段：${formatZone(plan.filters, language)}`,
    `- 过滤条件：${formatFilterSelections(plan.filterSelections, language)}`,
    '',
    '透视表已经按这个配置刷新。你可以继续说“改成按申请人看”或“只看待审批状态”。',
    '',
    `原始需求：${question}`,
  ].join('\n');
}

export function splitMessageChunks(message: string, chunkSize = 42): string[] {
  const text = message.trim();
  if (!text) {
    return [];
  }
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }
  return chunks;
}

export async function runTrReportAi(
  question: string,
  access: TravelReportAccessContext,
  options?: TrReportAiRunOptions,
): Promise<TrReportAiResult> {
  emitProgress(options?.onProgress, 'question_understanding', '正在理解报表需求', question);
  const metadata = await loadRuntimeMetadataRuntime(access, {
    toText,
    toFiniteNumber: (value) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    },
  });

  emitProgress(options?.onProgress, 'tool_analysis', '正在分析透视工具配置方法', TR_REPORT_AI_TOOL_NAME);
  const llm = getLlmConfig();
  const planned = await planPivotToolInput(question, metadata, access, llm);
  const plan = ensureUsablePlan(planned.plan);

  emitProgress(options?.onProgress, 'tool_execution', '正在应用透视配置', JSON.stringify(plan));
  return {
    toolName: TR_REPORT_AI_TOOL_NAME,
    summary: buildAssistantMessage(question, planned.summary, plan, planned.language),
    plan,
  };
}
