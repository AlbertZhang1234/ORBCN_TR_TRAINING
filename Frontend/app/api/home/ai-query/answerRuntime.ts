import { buildAnswerPrompt } from './prompts';
import {
  decideCardPlan,
  dimensionLabel,
  makeChartCardBlock,
  metricLabel,
  stripUnsafeJsonCardBlocks,
  type CardDecisionLlmConfig,
  type CardDimension,
} from './cardRuntime';
import type { OttoGroupedRow, OttoMetric, OttoQueryResult, OttoRuntimeMetadata, OttoToolInput } from './ottoVTrAllTool';

interface BuildAnswerDeps {
  callChatCompletion: (
    config: CardDecisionLlmConfig,
    messages: Array<{ role: 'system' | 'user'; content: string }>,
    maxTokens: number,
  ) => Promise<string>;
  callChatCompletionStream?: (
    config: CardDecisionLlmConfig,
    messages: Array<{ role: 'system' | 'user'; content: string }>,
    maxTokens: number,
    onDelta: (delta: string) => void,
  ) => Promise<string>;
  extractJsonObject: (raw: string) => string;
  loadCardRows: (dimension: CardDimension, metric: OttoMetric, topN: number) => Promise<Array<{ name: string; value: number }>>;
  onAnswerDelta?: (delta: string) => void;
}

function formatMoney(value: number): string {
  return `¥${value.toFixed(2)}`;
}

function containsMarkdownTable(markdown: string): boolean {
  return /\|[^\n]+\|\n\|[\s:-]+\|/m.test(markdown);
}

function hasKpiSection(markdown: string): boolean {
  return /###\s*(KPI|查询摘要|摘要|Summary)/i.test(markdown);
}

function buildKpiSection(plan: OttoToolInput, result: OttoQueryResult): string {
  const dateRange = [result.aggregate.firstDate, result.aggregate.lastDate].filter(Boolean).join(' -> ');

  if (plan.language === 'en') {
    const lines = [
      '### KPI',
      `- Rows: **${result.aggregate.rowCount}**`,
      `- Reimbursements: **${result.aggregate.reimbursementCount}**`,
      `- Invoices: **${result.aggregate.invoiceCount}**`,
      `- Gross amount: **${formatMoney(result.aggregate.grossAmount)}**`,
      `- Net amount: **${formatMoney(result.aggregate.totalNetAmount)}**`,
      `- Tax amount: **${formatMoney(result.aggregate.taxAmount)}**`,
    ];
    if (dateRange) {
      lines.push(`- Date range: **${dateRange}**`);
    }
    return lines.join('\n');
  }

  const lines = [
    '### KPI',
    `- 命中明细行：**${result.aggregate.rowCount}**`,
    `- 相关报销单：**${result.aggregate.reimbursementCount}**`,
    `- 相关发票：**${result.aggregate.invoiceCount}**`,
    `- 发票总额：**${formatMoney(result.aggregate.grossAmount)}**`,
    `- 未税金额：**${formatMoney(result.aggregate.totalNetAmount)}**`,
    `- 税额：**${formatMoney(result.aggregate.taxAmount)}**`,
  ];
  if (dateRange) {
    lines.push(`- 日期范围：**${dateRange}**`);
  }
  return lines.join('\n');
}

function buildGroupedTableSection(plan: OttoToolInput, result: OttoQueryResult): string {
  if (result.groupedRows.length === 0) {
    return '';
  }
  const header = plan.language === 'en'
    ? '### Breakdown\n| Category | Gross Amount | Invoices | Reimbursements |\n| --- | ---: | ---: | ---: |'
    : '### 汇总表\n| 分类 | 发票总额 | 发票数 | 报销单数 |\n| --- | ---: | ---: | ---: |';
  const body = result.groupedRows
    .slice(0, 8)
    .map(
      (row) =>
        `| ${row.label || '-'} | ${formatMoney(row.grossAmount)} | ${row.invoiceCount} | ${row.reimbursementCount} |`,
    )
    .join('\n');
  return `${header}\n${body}`;
}

function buildRecordsTableSection(plan: OttoToolInput, result: OttoQueryResult): string {
  if (result.records.length === 0) {
    return '';
  }
  const header = plan.language === 'en'
    ? '### Sample Records\n| TR | Invoice | Applicant | Project | Amount | Approval | Booking |\n| --- | --- | --- | --- | ---: | --- | --- |'
    : '### 明细表\n| 报销单 | 发票 | 申请人 | 项目 | 金额 | 审批 | 记账 |\n| --- | --- | --- | --- | ---: | --- | --- |';
  const body = result.records
    .slice(0, 6)
    .map(
      (row) =>
        `| ${row.trno || row.trId} | ${row.invoiceNo || '-'} | ${row.trUserName || '-'} | ${row.projectDescription || '-'} | ${formatMoney(row.grossAmount || row.trAmount)} | ${row.approvalStatus || '-'} | ${row.bookingStatus || '-'} |`,
    )
    .join('\n');
  return `${header}\n${body}`;
}

function buildStructuredAppendix(plan: OttoToolInput, result: OttoQueryResult, markdown: string): string {
  const sections: string[] = [];
  if (!hasKpiSection(markdown)) {
    sections.push(buildKpiSection(plan, result));
  }
  if (!containsMarkdownTable(markdown)) {
    if (result.groupedRows.length > 0) {
      sections.push(buildGroupedTableSection(plan, result));
    } else if (result.records.length > 0) {
      sections.push(buildRecordsTableSection(plan, result));
    }
  }
  return sections.filter(Boolean).join('\n\n');
}

function summarizeMetricValue(row: OttoGroupedRow, metric: OttoMetric): string {
  switch (metric) {
    case 'invoice_count':
      return `${row.invoiceCount}`;
    case 'reimbursement_count':
      return `${row.reimbursementCount}`;
    case 'line_count':
      return `${row.lineCount}`;
    case 'totalnetamount':
      return formatMoney(row.totalNetAmount);
    case 'taxamount':
      return formatMoney(row.taxAmount);
    case 'tr_amount':
      return formatMoney(row.trAmount);
    default:
      return formatMoney(row.grossAmount);
  }
}

function uniquePush(target: string[], value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return;
  }
  if (!target.includes(normalized)) {
    target.push(normalized);
  }
}

function buildSuggestions(plan: OttoToolInput, result: OttoQueryResult): string[] {
  const suggestions: string[] = [];
  const topLabel = result.groupedRows[0]?.label?.trim();
  const hasRejectedLike = result.records.some((row) => String(row.approvalStatus ?? '').toUpperCase().includes('REJECT'));
  const hasUnbookedLike = result.records.some((row) => String(row.bookingStatus ?? '').toUpperCase() !== 'BOOKED');
  const hasInvoiceWithoutReimbursement = result.aggregate.invoiceCount > 0 && result.aggregate.reimbursementCount === 0;

  if (plan.language === 'en') {
    uniquePush(suggestions, 'List the latest 5 matching invoice details');
    if (topLabel && plan.operation === 'grouped') {
      uniquePush(suggestions, `Drill down into "${topLabel}" details`);
    }
    if (plan.groupBy !== 'project_description') {
      uniquePush(suggestions, 'Compare this scope by project');
    }
    if (plan.groupBy !== 'bookingcode') {
      uniquePush(suggestions, 'Show booking code distribution');
    }
    if (hasRejectedLike || hasUnbookedLike) {
      uniquePush(suggestions, 'Break down approval and booking statuses');
    }
    if (hasInvoiceWithoutReimbursement) {
      uniquePush(suggestions, 'Why are these invoices not linked to reimbursements?');
    }
    return suggestions.slice(0, 4);
  }

  uniquePush(suggestions, '列出这批数据最近 5 条明细');
  if (topLabel && plan.operation === 'grouped') {
    uniquePush(suggestions, `展开看「${topLabel}」的明细与来源`);
  }
  if (plan.groupBy !== 'project_description') {
    uniquePush(suggestions, '按项目比较这批数据的金额');
  }
  if (plan.groupBy !== 'bookingcode') {
    uniquePush(suggestions, '按费用类别看占比和金额分布');
  }
  if (hasRejectedLike || hasUnbookedLike) {
    uniquePush(suggestions, '看看审批状态和记账状态分布');
  }
  if (hasInvoiceWithoutReimbursement) {
    uniquePush(suggestions, '为什么这些发票没有关联到报销单');
  }
  if (result.aggregate.rowCount > 0 && plan.scope !== 'mine') {
    uniquePush(suggestions, '只看我自己的相关数据');
  }
  return suggestions.slice(0, 4);
}

function buildSuggestionsCard(plan: OttoToolInput, result: OttoQueryResult): string {
  return [
    '```json',
    JSON.stringify(
      {
        type: 'suggestions-card',
        title: plan.language === 'en' ? 'Suggested Follow-ups (Dynamic)' : '继续追问（基于当前结果）',
        suggestions: buildSuggestions(plan, result),
      },
      null,
      2,
    ),
    '```',
  ].join('\n');
}

function buildFallbackAnswer(question: string, plan: OttoToolInput, result: OttoQueryResult, metadata: OttoRuntimeMetadata): string {
  const sections: string[] = [];
  const hasRows = result.aggregate.rowCount > 0;

  if (!hasRows) {
    if (plan.language === 'en') {
      sections.push(`No matching data was found for "${question}".`);
    } else {
      sections.push(`没有找到与“${question}”匹配的数据。`);
    }
    if (plan.groupBy && (metadata.nonEmptyCounts[plan.groupBy] ?? 0) === 0) {
      sections.push(plan.language === 'en'
        ? `The field ${plan.groupBy} currently has no non-empty values in otto_v_tr_all.`
        : `当前 otto_v_tr_all 中字段 ${plan.groupBy} 没有非空数据。`);
    }
    if (result.notes.length > 0) {
      sections.push(result.notes.map((item) => `- ${item}`).join('\n'));
    }
    sections.push(buildSuggestionsCard(plan, result));
    return sections.join('\n\n');
  }

  sections.push(buildKpiSection(plan, result));
  if (result.groupedRows.length > 0) {
    sections.push(plan.language === 'en' ? '### Top Breakdown' : '### 重点分布');
    sections.push(result.groupedRows.slice(0, 5).map((row, index) => `${index + 1}. ${row.label}: ${summarizeMetricValue(row, plan.metric)}`).join('\n'));
    sections.push(buildGroupedTableSection(plan, result));
  } else if (result.records.length > 0) {
    sections.push(buildRecordsTableSection(plan, result));
  }

  if (result.notes.length > 0) {
    const label = plan.language === 'en' ? 'Notes' : '说明';
    sections.push(`\n### ${label}`);
    sections.push(result.notes.map((item) => `- ${item}`).join('\n'));
  }

  sections.push(`\n${buildSuggestionsCard(plan, result)}`);
  return sections.join('\n');
}

export async function buildOttoAnswer(
  question: string,
  plan: OttoToolInput,
  result: OttoQueryResult,
  metadata: OttoRuntimeMetadata,
  llm: CardDecisionLlmConfig | null,
  deps: BuildAnswerDeps,
): Promise<string> {
  const fallback = buildFallbackAnswer(question, plan, result, metadata);
  const cardPlan = await decideCardPlan(question, plan, result, llm, {
    callChatCompletion: deps.callChatCompletion,
    extractJsonObject: deps.extractJsonObject,
  });
  const cardBlocks: string[] = [];

  if (cardPlan.showCards) {
    for (const card of cardPlan.cards) {
      const grouped = await deps.loadCardRows(card.dimension, card.metric, card.topN);
      if (grouped.length < 2) {
        continue;
      }
      const fallbackSubtitle = `${dimensionLabel(card.dimension, plan.language)} · ${metricLabel(card.metric, plan.language)}`;
      const block = makeChartCardBlock(
        card.type,
        card.title || (plan.language === 'en' ? 'Chart' : '图表'),
        card.subtitle || fallbackSubtitle,
        grouped,
      );
      if (block) {
        cardBlocks.push(block);
      }
    }
  }

  if (!llm) {
    deps.onAnswerDelta?.(cardBlocks.length > 0 ? `${fallback}\n\n${cardBlocks.join('\n\n')}` : fallback);
    return cardBlocks.length > 0 ? `${fallback}\n\n${cardBlocks.join('\n\n')}` : fallback;
  }

  if (deps.callChatCompletionStream && deps.onAnswerDelta) {
    try {
      const streamedMarkdown = await deps.callChatCompletionStream(
        llm,
        [
          {
            role: 'system',
            content: plan.language === 'en'
              ? 'Return markdown only. Be factual and concise. Prefer markdown tables whenever data exists. Use narrative text only to frame the conclusion and short insights.'
              : '只返回 markdown，保持准确、克制、简洁。只要有数据就优先用 markdown 表格呈现，正文只负责结论和简短洞察。',
          },
          {
            role: 'user',
            content: buildAnswerPrompt(question, plan, result, metadata),
          },
        ],
        900,
        (delta) => {
          if (delta) {
            deps.onAnswerDelta?.(delta);
          }
        },
      );
      const cleaned = stripUnsafeJsonCardBlocks(streamedMarkdown);
      if (!cleaned) {
        deps.onAnswerDelta(fallback);
        return fallback;
      }
      const appendix = buildStructuredAppendix(plan, result, cleaned);
      const tail = [appendix, ...cardBlocks, buildSuggestionsCard(plan, result)].filter(Boolean).join('\n\n');
      if (tail) {
        deps.onAnswerDelta(`\n\n${tail}`);
      }
      return [cleaned, tail].filter(Boolean).join('\n\n').trim() || fallback;
    } catch {
      const fallbackMessage = cardBlocks.length > 0 ? `${fallback}\n\n${cardBlocks.join('\n\n')}` : fallback;
      deps.onAnswerDelta(fallbackMessage);
      return fallbackMessage;
    }
  }

  try {
    const markdown = await deps.callChatCompletion(
      llm,
      [
        {
          role: 'system',
          content: plan.language === 'en'
            ? 'Return markdown only. Be factual and concise. Prefer markdown tables whenever data exists. Use narrative text only to frame the conclusion and short insights.'
            : '只返回 markdown，保持准确、克制、简洁。只要有数据就优先用 markdown 表格呈现，正文只负责结论和简短洞察。',
        },
        {
          role: 'user',
          content: buildAnswerPrompt(question, plan, result, metadata),
        },
      ],
      900,
    );
    const cleaned = stripUnsafeJsonCardBlocks(markdown);
    if (!cleaned) {
      return fallback;
    }
    const appendix = buildStructuredAppendix(plan, result, cleaned);
    const merged = [cleaned, appendix, ...cardBlocks, buildSuggestionsCard(plan, result)].filter(Boolean).join('\n\n');
    return merged.trim() || fallback;
  } catch {
    if (cardBlocks.length > 0) {
      return `${fallback}\n\n${cardBlocks.join('\n\n')}`;
    }
    return fallback;
  }
}
