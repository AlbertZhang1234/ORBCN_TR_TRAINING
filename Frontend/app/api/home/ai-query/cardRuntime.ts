import { buildCardDecisionPrompt } from './prompts';
import type { OttoMetric, OttoQueryResult, OttoToolInput } from './ottoVTrAllTool';

export type ChartCardType = 'bar-chart-card' | 'line-chart-card' | 'pie-chart-card';
export type CardDimension =
  | 'tr_user_name'
  | 'project_description'
  | 'customername'
  | 'approvalstatus'
  | 'bookingstatus'
  | 'invoice_status'
  | 'invoice_supplier'
  | 'travel_destination'
  | 'bookingcode'
  | 'currency';

export interface CardDecisionItem {
  type: ChartCardType;
  title: string;
  subtitle?: string;
  dimension: CardDimension;
  metric: OttoMetric;
  topN: number;
}

export interface CardDecision {
  showCards: boolean;
  cards: CardDecisionItem[];
}

export interface CardDecisionLlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface DecideCardPlanDeps {
  callChatCompletion: (
    config: CardDecisionLlmConfig,
    messages: Array<{ role: 'system' | 'user'; content: string }>,
    maxTokens: number,
  ) => Promise<string>;
  extractJsonObject: (raw: string) => string;
}

const CARD_DIMENSIONS: CardDimension[] = [
  'tr_user_name',
  'project_description',
  'customername',
  'approvalstatus',
  'bookingstatus',
  'invoice_status',
  'invoice_supplier',
  'travel_destination',
  'bookingcode',
  'currency',
];

const CHART_CARD_TYPES: ChartCardType[] = ['bar-chart-card', 'line-chart-card', 'pie-chart-card'];
const CARD_TRIGGER_PATTERN =
  /图表|图|图形|柱状|条形|饼图|折线|趋势|分布|占比|汇总|分类|对比|比较|排名|top|rank|chart|graph|summary|breakdown|distribution|share|compare/i;

function toText(value: unknown): string {
  return String(value ?? '').trim();
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

function clampLimit(value: unknown, fallback: number): number {
  const numberValue = Math.trunc(toFiniteNumber(value));
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return fallback;
  }
  return Math.max(1, Math.min(numberValue, 20));
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

function isChartCardType(value: string): value is ChartCardType {
  return CHART_CARD_TYPES.includes(value as ChartCardType);
}

function isCardDimension(value: string): value is CardDimension {
  return CARD_DIMENSIONS.includes(value as CardDimension);
}

function hasChartableData(result: OttoQueryResult): boolean {
  return result.groupedRows.length >= 2 || result.aggregate.rowCount >= 2;
}

function shouldPreferCards(question: string, plan: OttoToolInput, result: OttoQueryResult): boolean {
  if (!hasChartableData(result)) {
    return false;
  }
  return CARD_TRIGGER_PATTERN.test(question) || plan.operation === 'grouped' || Boolean(plan.groupBy);
}

function buildHeuristicCards(question: string, plan: OttoToolInput): CardDecisionItem[] {
  const fallbackDimension = (isCardDimension(toText(plan.groupBy)) ? toText(plan.groupBy) : 'bookingcode') as CardDimension;
  const subtitle = `${dimensionLabel(fallbackDimension, plan.language)} · ${metricLabel(plan.metric, plan.language)}`;
  const isCompositionQuestion = /分类|类别|占比|构成|分布|share|distribution|breakdown|composition|pie/i.test(question);

  if (isCompositionQuestion) {
    return [
      {
        type: 'pie-chart-card',
        title: plan.language === 'en' ? 'Composition Overview' : '构成占比',
        subtitle,
        dimension: fallbackDimension,
        metric: plan.metric,
        topN: 6,
      },
      {
        type: 'bar-chart-card',
        title: plan.language === 'en' ? 'Category Comparison' : '分类对比',
        subtitle,
        dimension: fallbackDimension,
        metric: plan.metric,
        topN: 6,
      },
    ];
  }

  return [
    {
      type: 'bar-chart-card',
      title: plan.language === 'en' ? 'Top Breakdown' : 'Top 分布',
      subtitle,
      dimension: fallbackDimension,
      metric: plan.metric,
      topN: 6,
    },
  ];
}

export function metricLabel(metric: OttoMetric, language: 'zh' | 'en'): string {
  if (language === 'en') {
    switch (metric) {
      case 'invoice_count':
        return 'Invoice Count';
      case 'reimbursement_count':
        return 'Reimbursement Count';
      case 'line_count':
        return 'Line Count';
      case 'totalnetamount':
        return 'Net Amount';
      case 'taxamount':
        return 'Tax Amount';
      case 'tr_amount':
        return 'TR Amount';
      default:
        return 'Gross Amount';
    }
  }
  switch (metric) {
    case 'invoice_count':
      return '发票数量';
    case 'reimbursement_count':
      return '报销单数量';
    case 'line_count':
      return '明细行数量';
    case 'totalnetamount':
      return '未税金额';
    case 'taxamount':
      return '税额';
    case 'tr_amount':
      return '报销行金额';
    default:
      return '发票总额';
  }
}

export function dimensionLabel(field: CardDimension, language: 'zh' | 'en'): string {
  const zhMap: Record<CardDimension, string> = {
    tr_user_name: '申请人',
    project_description: '项目',
    customername: '客户',
    approvalstatus: '审批状态',
    bookingstatus: '记账状态',
    invoice_status: '发票状态',
    invoice_supplier: '供应商',
    travel_destination: '目的地',
    bookingcode: '记账码',
    currency: '币种',
  };
  const enMap: Record<CardDimension, string> = {
    tr_user_name: 'Applicant',
    project_description: 'Project',
    customername: 'Customer',
    approvalstatus: 'Approval Status',
    bookingstatus: 'Booking Status',
    invoice_status: 'Invoice Status',
    invoice_supplier: 'Supplier',
    travel_destination: 'Destination',
    bookingcode: 'Booking Code',
    currency: 'Currency',
  };
  return language === 'en' ? enMap[field] : zhMap[field];
}

function normalizeCardDecision(raw: unknown, question: string, plan: OttoToolInput, result: OttoQueryResult): CardDecision {
  const input = (raw ?? {}) as Record<string, unknown>;
  const preferCards = shouldPreferCards(question, plan, result);
  const showCards = hasChartableData(result) && (Boolean(input.showCards) || preferCards);
  const fallbackDimension = (isCardDimension(toText(plan.groupBy)) ? toText(plan.groupBy) : 'bookingcode') as CardDimension;
  const fallbackCard: CardDecisionItem = {
    type: 'bar-chart-card',
    title: plan.language === 'en' ? 'Breakdown' : '分布概览',
    subtitle: `${dimensionLabel(fallbackDimension, plan.language)} · ${metricLabel(plan.metric, plan.language)}`,
    dimension: fallbackDimension,
    metric: plan.metric,
    topN: 6,
  };

  if (!showCards) {
    return { showCards: false, cards: [] };
  }

  const cards = Array.isArray(input.cards) ? input.cards : [];
  const normalized = cards
    .map((item) => {
      const card = (item ?? {}) as Record<string, unknown>;
      const typeText = toText(card.type);
      const dimensionText = toText(card.dimension);
      const metricText = toText(card.metric);
      if (!isChartCardType(typeText) || !isCardDimension(dimensionText) || !isMetric(metricText)) {
        return null;
      }
      return {
        type: typeText,
        title: toText(card.title) || fallbackCard.title,
        subtitle: toText(card.subtitle),
        dimension: dimensionText,
        metric: metricText,
        topN: clampLimit(card.topN, 6),
      } as CardDecisionItem;
    })
    .filter((item): item is CardDecisionItem => Boolean(item))
    .slice(0, 2)
    .map((item) => ({ ...item, topN: Math.min(10, Math.max(3, item.topN)) }));

  if (normalized.length > 0) {
    return { showCards: true, cards: normalized };
  }
  const heuristicCards = buildHeuristicCards(question, plan).filter((item) => item.dimension === fallbackDimension || isCardDimension(item.dimension));
  return { showCards: true, cards: heuristicCards.length > 0 ? heuristicCards : [fallbackCard] };
}

export async function decideCardPlan(
  question: string,
  plan: OttoToolInput,
  result: OttoQueryResult,
  llm: CardDecisionLlmConfig | null,
  deps: DecideCardPlanDeps,
): Promise<CardDecision> {
  if (!hasChartableData(result)) {
    return { showCards: false, cards: [] };
  }

  if (!llm) {
    if (shouldPreferCards(question, plan, result)) {
      return {
        showCards: true,
        cards: buildHeuristicCards(question, plan),
      };
    }
    return { showCards: false, cards: [] };
  }

  try {
    const raw = await deps.callChatCompletion(
      llm,
      [
        {
          role: 'system',
          content: 'Return strict JSON only. No markdown. No explanation.',
        },
        {
          role: 'user',
          content: buildCardDecisionPrompt(question, plan, result),
        },
      ],
      400,
    );
    const jsonText = deps.extractJsonObject(raw);
    if (!jsonText) {
      return normalizeCardDecision(null, question, plan, result);
    }
    return normalizeCardDecision(JSON.parse(jsonText), question, plan, result);
  } catch {
    return normalizeCardDecision(null, question, plan, result);
  }
}

export function makeChartCardBlock(type: ChartCardType, title: string, subtitle: string, data: Array<{ name: string; value: number }>): string | null {
  if (!title || data.length === 0) {
    return null;
  }

  if (type === 'pie-chart-card') {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (!(total > 0)) {
      return null;
    }
    const pieData = data.map((item) => ({
      name: item.name,
      value: Number(item.value.toFixed(2)),
      percent: Number(((item.value / total) * 100).toFixed(2)),
    }));
    return ['```json', JSON.stringify({ type, title, subtitle, data: pieData }, null, 2), '```'].join('\n');
  }

  const chartData = data.map((item) => ({ name: item.name, value: Number(item.value.toFixed(2)) }));
  return ['```json', JSON.stringify({ type, title, subtitle, data: chartData }, null, 2), '```'].join('\n');
}

export function stripUnsafeJsonCardBlocks(markdown: string): string {
  if (!markdown.trim()) {
    return '';
  }
  const cleaned = markdown.replace(/```json\s*([\s\S]*?)```/gi, (block, rawJson) => {
    try {
      const parsed = JSON.parse(String(rawJson ?? '').trim()) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
        return '';
      }
      return block;
    } catch {
      return block;
    }
  });
  return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}
