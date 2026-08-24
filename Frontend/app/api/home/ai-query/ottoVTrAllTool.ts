import {
  type TravelReportAccessContext,
} from '../../../../services/TravelReport/server';
import {
  type CardDecisionLlmConfig,
} from './cardRuntime';
import { buildOttoAnswer } from './answerRuntime';
import { loadGroupedRowsForCardData } from './cardDataRuntime';
import {
  appendServiceAwareNotesRuntime,
  executeOttoToolRuntime,
  loadInvoiceDateCompanionInsightRuntime,
} from './executionRuntime';
import { buildWhereClauseRuntime, normalizePlanForAccessRuntime } from './queryRuntime';
import { buildFallbackToolInputRuntime, planToolInputRuntime } from './planningRuntime';
import { loadRuntimeMetadataRuntime } from './metadataRuntime';

export type OttoField =
  | 'tr_id'
  | 'trno'
  | 'tr_created_at'
  | 'tr_userid'
  | 'tr_user_name'
  | 'tr_projectid'
  | 'project_description'
  | 'project_manager_userid'
  | 'project_manager_name'
  | 'customerid'
  | 'customername'
  | 'approvalstatus'
  | 'bookingstatus'
  | 'approver_userid'
  | 'approver_name'
  | 'invoiceno'
  | 'tr_amount'
  | 'line_trchargeable'
  | 'line_txchargeable'
  | 'invoice_userid'
  | 'invoice_user_name'
  | 'travelid'
  | 'travel_fromdate'
  | 'travel_todate'
  | 'travel_destination'
  | 'invoicedate'
  | 'totalnetamount'
  | 'taxamount'
  | 'grossamount'
  | 'bookingcode'
  | 'currency'
  | 'invoice_status'
  | 'invoice_comment'
  | 'invoice_description'
  | 'invoice_supplier';

export type OttoGroupField =
  | 'tr_user_name'
  | 'project_description'
  | 'customername'
  | 'approver_name'
  | 'project_manager_name'
  | 'invoice_user_name'
  | 'invoice_supplier'
  | 'invoice_description'
  | 'travel_destination'
  | 'bookingcode'
  | 'approvalstatus'
  | 'bookingstatus'
  | 'invoice_status'
  | 'currency';

export type OttoMetric =
  | 'grossamount'
  | 'totalnetamount'
  | 'taxamount'
  | 'tr_amount'
  | 'invoice_count'
  | 'reimbursement_count'
  | 'line_count';

export type OttoDateField = 'invoicedate' | 'tr_created_at' | 'travel_fromdate' | 'travel_todate';
export type OttoOperation = 'summary' | 'records' | 'grouped';
export type OttoScope = 'mine' | 'team' | 'allVisible';
export type OttoSortField =
  | 'metric'
  | 'invoicedate'
  | 'tr_created_at'
  | 'travel_fromdate'
  | 'travel_todate'
  | 'grossamount'
  | 'totalnetamount'
  | 'taxamount'
  | 'tr_amount'
  | 'trno'
  | 'invoiceno';
export type OttoSortDirection = 'asc' | 'desc';
export type OttoFilterOperator = 'eq' | 'contains' | 'in' | 'gte' | 'lte' | 'is_null' | 'not_null';

export type OttoAuthContext = TravelReportAccessContext;

export interface OttoFilter {
  field: OttoField;
  operator: OttoFilterOperator;
  value?: string | number | boolean | string[] | number[] | boolean[] | null;
}

export interface OttoToolInput {
  language: 'zh' | 'en';
  operation: OttoOperation;
  metric: OttoMetric;
  scope: OttoScope;
  groupBy: OttoGroupField | null;
  dateField: OttoDateField;
  dateFrom: string | null;
  dateTo: string | null;
  filters: OttoFilter[];
  searchTerms: string[];
  sortBy: OttoSortField | null;
  sortDirection: OttoSortDirection;
  limit: number;
  amountMin: number | null;
  amountMax: number | null;
}

interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

interface ChatCompletionStreamChunk {
  choices?: Array<{
    delta?: { content?: string };
    message?: { content?: string };
  }>;
  error?: { message?: string };
}


export interface OttoValueHint {
  value: string;
  count: number;
}

export interface OttoRuntimeMetadata {
  summary: {
    rowCount: number;
    reimbursementCount: number;
    invoiceCount: number;
  };
  nonEmptyCounts: Partial<Record<OttoField, number>>;
  topValues: Partial<Record<OttoField, OttoValueHint[]>>;
}

export interface OttoGroupedRow {
  label: string;
  reimbursementCount: number;
  invoiceCount: number;
  lineCount: number;
  grossAmount: number;
  totalNetAmount: number;
  taxAmount: number;
  trAmount: number;
}

export interface OttoRecordRow {
  trId: number;
  trno: string;
  trUserName: string;
  projectDescription: string;
  customerName: string;
  approvalStatus: string;
  bookingStatus: string;
  approverName: string;
  invoiceNo: string;
  trAmount: number;
  totalNetAmount: number;
  taxAmount: number;
  grossAmount: number;
  currency: string;
  invoiceDate: string;
  createdAt: string;
  travelFromDate: string;
  travelToDate: string;
  travelDestination: string;
  bookingCode: string;
  invoiceStatus: string;
  invoiceSupplier: string;
  invoiceDescription: string;
}

export interface OttoQueryResult {
  aggregate: {
    rowCount: number;
    reimbursementCount: number;
    invoiceCount: number;
    lineCount: number;
    grossAmount: number;
    totalNetAmount: number;
    taxAmount: number;
    trAmount: number;
    firstDate: string;
    lastDate: string;
  };
  groupedRows: OttoGroupedRow[];
  records: OttoRecordRow[];
  notes: string[];
}

export interface OttoNaturalLanguageResult {
  plan: OttoToolInput;
  result: OttoQueryResult;
  metadata: OttoRuntimeMetadata;
  message: string;
}

export type OttoProgressStage =
  | 'question_understanding'
  | 'tool_selection'
  | 'parameter_decision'
  | 'tool_execution'
  | 'data_organization';

export interface OttoProgressEvent {
  stage: OttoProgressStage;
  message: string;
  detail?: string;
  timestamp: string;
}

export interface OttoRunOptions {
  onProgress?: (event: OttoProgressEvent) => void;
  onAnswerStart?: () => void;
  onAnswerDelta?: (delta: string) => void;
}


function toText(value: unknown): string {
  return String(value ?? '').trim();
}

function toRawText(value: unknown): string {
  return value == null ? '' : String(value);
}

function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function toLowerText(value: unknown): string {
  return toText(value).toLowerCase();
}

function emitProgress(
  onProgress: OttoRunOptions['onProgress'] | undefined,
  stage: OttoProgressStage,
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

function pushParam(params: unknown[], value: unknown): string {
  params.push(value);
  return `$${params.length}`;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  const text = toLowerText(value);
  if (text === 'true' || text === 'yes' || text === '1') {
    return true;
  }
  if (text === 'false' || text === 'no' || text === '0') {
    return false;
  }
  return null;
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

export function getLlmConfig(): LlmConfig | null {
  const baseUrl = toText(process.env.NEXT_PUBLIC_LLM_BASEURL).replace(/\/+$/, '');
  const apiKey = toText(process.env.NEXT_PUBLIC_LLM_APIKEY);
  const model = toText(process.env.NEXT_PUBLIC_LLM_MODEL);
  if (!baseUrl || !apiKey || !model) {
    return null;
  }
  return { baseUrl, apiKey, model };
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

  const payload = (await response.json()) as ChatCompletionResponse;
  if (!response.ok) {
    throw new Error(toText(payload?.error?.message) || `LLM request failed (${response.status})`);
  }

  return toText(payload?.choices?.[0]?.message?.content);
}

async function callChatCompletionStream(
  config: LlmConfig,
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  maxTokens: number,
  onDelta: (delta: string) => void,
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
      stream: true,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ChatCompletionResponse;
    throw new Error(toText(payload?.error?.message) || `LLM stream request failed (${response.status})`);
  }

  const contentType = String(response.headers.get('content-type') ?? '').toLowerCase();
  if (!response.body || !contentType.includes('text/event-stream')) {
    return callChatCompletion(config, messages, maxTokens);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  const consumeEventLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) {
      return;
    }
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') {
      return;
    }
    const chunk = JSON.parse(payload) as ChatCompletionStreamChunk;
    const delta = toRawText(chunk.choices?.[0]?.delta?.content) || toRawText(chunk.choices?.[0]?.message?.content);
    if (!delta) {
      return;
    }
    fullText += delta;
    onDelta(delta);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const eventText of events) {
      for (const line of eventText.split('\n')) {
        consumeEventLine(line);
      }
    }
  }

  if (buffer.trim()) {
    for (const line of buffer.split('\n')) {
      consumeEventLine(line);
    }
  }

  return fullText;
}

async function loadRuntimeMetadata(ctx: OttoAuthContext): Promise<OttoRuntimeMetadata> {
  return loadRuntimeMetadataRuntime(ctx, { toText, toFiniteNumber });
}

export function buildFallbackToolInput(question: string, metadata: OttoRuntimeMetadata): OttoToolInput {
  return buildFallbackToolInputRuntime(question, metadata);
}

async function planToolInput(question: string, metadata: OttoRuntimeMetadata, llm: LlmConfig | null): Promise<OttoToolInput> {
  return planToolInputRuntime(question, metadata, llm, {
    callChatCompletion,
    extractJsonObject,
    toText,
    toLowerText,
    toFiniteNumber,
  });
}

function buildWhereClause(params: unknown[], ctx: OttoAuthContext, plan: OttoToolInput): string {
  return buildWhereClauseRuntime(params, ctx, plan, {
    toText,
    toFiniteNumber,
    normalizeBoolean,
    pushParam,
  });
}

function normalizePlanForAccess(plan: OttoToolInput, ctx: OttoAuthContext): OttoToolInput {
  return normalizePlanForAccessRuntime(plan, ctx);
}

export async function executeOttoTool(plan: OttoToolInput, ctx: OttoAuthContext, metadata?: OttoRuntimeMetadata): Promise<OttoQueryResult> {
  const runtimeMetadata = metadata ?? (await loadRuntimeMetadata(ctx));
  return executeOttoToolRuntime(plan, ctx, runtimeMetadata, {
    buildWhereClause,
    toFiniteNumber,
    toText,
  });
}


export async function runOttoNaturalLanguageQuery(
  question: string,
  ctx: OttoAuthContext,
  llm: LlmConfig | null = getLlmConfig(),
  options?: OttoRunOptions,
): Promise<OttoNaturalLanguageResult> {
  emitProgress(options?.onProgress, 'question_understanding', '正在理解问题', question);
  const metadata = await loadRuntimeMetadata(ctx);

  emitProgress(options?.onProgress, 'tool_selection', '已选择查询工具', 'otto_v_tr_all_query');
  const plan = normalizePlanForAccess(await planToolInput(question, metadata, llm), ctx);

  emitProgress(
    options?.onProgress,
    'parameter_decision',
    '已确定查询参数',
    `operation=${plan.operation}, metric=${plan.metric}, groupBy=${plan.groupBy ?? '-'}, limit=${plan.limit}`,
  );

  emitProgress(options?.onProgress, 'tool_execution', '正在执行数据查询');
  const result = await executeOttoTool(plan, ctx, metadata);
  appendServiceAwareNotesRuntime(
    question,
    plan,
    result,
    await loadInvoiceDateCompanionInsightRuntime(question, ctx, plan, {
      buildWhereClause,
      toFiniteNumber,
      toText,
    }),
  );

  emitProgress(options?.onProgress, 'data_organization', '正在整理结果并生成回答');
  options?.onAnswerStart?.();
  const message = await buildOttoAnswer(
    question,
    plan,
    result,
    metadata,
    llm as CardDecisionLlmConfig | null,
    {
      callChatCompletion,
      callChatCompletionStream,
      extractJsonObject,
      onAnswerDelta: options?.onAnswerDelta,
      loadCardRows: (dimension, metric, topN) =>
        loadGroupedRowsForCardData(ctx, plan, dimension, metric, topN, {
          buildWhereClause,
          toText,
          toFiniteNumber,
        }),
    },
  );
  return { plan, result, metadata, message };
}
