import type { OttoField, OttoGroupField, OttoMetric, OttoQueryResult, OttoRuntimeMetadata, OttoToolInput } from './ottoVTrAllTool';

const BOOKING_CODE_GUIDE = [
  'PARK = 停车费 / Parking / 车位停车场',
  'TAXI = 出租车 / 网约车 / 打车 / 代驾',
  'AUTG = 高速费 / 过路费 / 过桥费 / ETC / 路桥',
  'BENL = 加油费 / 燃油费 / Petrol / Diesel / Fuel',
  'BEWI = 餐饮 / 工作餐 / Hospitality / Dining / Meals',
  'SOBE = 其他 / 未明确分类 / Others / Unclassified',
] as const;

const APPROVAL_STATUS_GUIDE = [
  'APPROVED = approved / 通过 / 已通过 / 审批通过',
  'REJECTED = rejected / 拒绝 / 驳回 / 已拒绝',
  'Wait for Approval = 待审批 / 待批准 / 审批中 / 审批未完成 / 没审批完 / 还没审批完 / pending approval / awaiting approval',
] as const;

const FIELD_ORDER: OttoField[] = [
  'tr_id',
  'trno',
  'tr_created_at',
  'tr_userid',
  'tr_user_name',
  'tr_projectid',
  'project_description',
  'project_manager_userid',
  'project_manager_name',
  'customerid',
  'customername',
  'approvalstatus',
  'bookingstatus',
  'approver_userid',
  'approver_name',
  'invoiceno',
  'tr_amount',
  'line_trchargeable',
  'line_txchargeable',
  'invoice_userid',
  'invoice_user_name',
  'travelid',
  'travel_fromdate',
  'travel_todate',
  'travel_destination',
  'invoicedate',
  'totalnetamount',
  'taxamount',
  'grossamount',
  'bookingcode',
  'currency',
  'invoice_status',
  'invoice_comment',
  'invoice_description',
  'invoice_supplier',
];

export function buildFieldCatalogPrompt(): string {
  const fields: Array<{
    field: OttoField;
    type: string;
    role: string;
    aliases: string[];
  }> = [
    { field: 'tr_id', type: 'bigint', role: 'reimbursement id', aliases: ['报销单id', 'header id'] },
    { field: 'trno', type: 'text', role: 'reimbursement number', aliases: ['报销单号', 'TR号'] },
    { field: 'tr_created_at', type: 'timestamp', role: 'reimbursement created time', aliases: ['报销创建时间', '提交时间'] },
    { field: 'tr_userid', type: 'text', role: 'applicant userid', aliases: ['申请人账号', '报销人账号'] },
    { field: 'tr_user_name', type: 'text', role: 'applicant name', aliases: ['申请人', '报销人', '谁'] },
    { field: 'tr_projectid', type: 'text', role: 'project id', aliases: ['项目ID'] },
    { field: 'project_description', type: 'text', role: 'project name/description', aliases: ['项目', '项目描述'] },
    { field: 'project_manager_userid', type: 'text', role: 'project manager userid', aliases: ['项目经理账号'] },
    { field: 'project_manager_name', type: 'text', role: 'project manager name', aliases: ['项目经理'] },
    { field: 'customerid', type: 'text', role: 'customer id', aliases: ['客户ID'] },
    { field: 'customername', type: 'text', role: 'customer name', aliases: ['客户', '客户名称'] },
    { field: 'approvalstatus', type: 'text', role: 'reimbursement approval status', aliases: ['审批状态', '报销状态'] },
    { field: 'bookingstatus', type: 'text', role: 'finance booking status', aliases: ['记账状态', '财务状态'] },
    { field: 'approver_userid', type: 'text', role: 'approver userid', aliases: ['审批人账号'] },
    { field: 'approver_name', type: 'text', role: 'approver name', aliases: ['审批人'] },
    { field: 'invoiceno', type: 'text', role: 'invoice number', aliases: ['发票号', '票号'] },
    { field: 'tr_amount', type: 'numeric', role: 'line reimbursement amount', aliases: ['报销行金额', '行金额'] },
    { field: 'line_trchargeable', type: 'boolean', role: 'reimbursement chargeable flag', aliases: ['报销可计费'] },
    { field: 'line_txchargeable', type: 'boolean', role: 'tax chargeable flag', aliases: ['税额可计费'] },
    { field: 'invoice_userid', type: 'text', role: 'invoice owner userid', aliases: ['发票所属人账号'] },
    { field: 'invoice_user_name', type: 'text', role: 'invoice owner name', aliases: ['发票所属人'] },
    { field: 'travelid', type: 'text', role: 'travel entry id', aliases: ['差旅行程ID'] },
    { field: 'travel_fromdate', type: 'date', role: 'travel start date', aliases: ['出发日期', '行程开始'] },
    { field: 'travel_todate', type: 'date', role: 'travel end date', aliases: ['结束日期', '行程结束'] },
    { field: 'travel_destination', type: 'text', role: 'travel destination/city', aliases: ['目的地', '城市'] },
    { field: 'invoicedate', type: 'date', role: 'invoice date', aliases: ['发票日期', '开票日期'] },
    { field: 'totalnetamount', type: 'numeric', role: 'invoice net amount', aliases: ['未税金额', '净额'] },
    { field: 'taxamount', type: 'numeric', role: 'invoice tax amount', aliases: ['税额', '增值税'] },
    { field: 'grossamount', type: 'numeric', role: 'invoice gross amount', aliases: ['含税金额', '发票总额', '总金额'] },
    {
      field: 'bookingcode',
      type: 'text',
      role: 'invoice category code',
      aliases: ['费用类别', 'booking code', '报销类别', '高速费', '过路费', '停车费', '打车', '加油费', '餐饮', '其他'],
    },
    { field: 'currency', type: 'text', role: 'currency', aliases: ['币种'] },
    { field: 'invoice_status', type: 'text', role: 'invoice workflow status', aliases: ['发票状态'] },
    { field: 'invoice_comment', type: 'text', role: 'invoice comment', aliases: ['发票备注'] },
    { field: 'invoice_description', type: 'text', role: 'invoice description', aliases: ['发票描述', '费用说明'] },
    { field: 'invoice_supplier', type: 'text', role: 'supplier/vendor name', aliases: ['供应商', '商家', '开票方'] },
  ];

  return fields
    .filter((item) => FIELD_ORDER.includes(item.field))
    .map((item) => `- ${item.field} [${item.type}]: ${item.role}; aliases=${item.aliases.join(', ')}`)
    .join('\n');
}

export function buildMetadataPrompt(metadata: OttoRuntimeMetadata): string {
  const lines: string[] = [];
  lines.push(`Visible rows=${metadata.summary.rowCount}, reimbursements=${metadata.summary.reimbursementCount}, invoices=${metadata.summary.invoiceCount}`);

  const availability = FIELD_ORDER.map((field) => {
    const count = metadata.nonEmptyCounts[field] ?? 0;
    return `${field}:${count}`;
  }).join(', ');
  lines.push(`Non-empty counts: ${availability}`);

  for (const [field, values] of Object.entries(metadata.topValues)) {
    const formatted = values.map((item) => `${item.value} (${item.count})`).join(', ');
    lines.push(`Top values for ${field}: ${formatted || '(none)'}`);
  }

  return lines.join('\n');
}

export function buildPlannerPrompt(metadata: OttoRuntimeMetadata): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    'You are planning arguments for the otto_v_tr_all_query tool.',
    `Today is ${today}.`,
    'You must understand the view fields first, then output JSON only. Never write SQL.',
    'Field catalog:',
    buildFieldCatalogPrompt(),
    '',
    'Runtime data hints for the current user visibility:',
    buildMetadataPrompt(metadata),
    '',
    'Return exactly this JSON shape:',
    '{"language":"zh|en","operation":"summary|records|grouped","metric":"grossamount|totalnetamount|taxamount|tr_amount|invoice_count|reimbursement_count|line_count","scope":"mine|team|allVisible","groupBy":null|"tr_user_name"|"project_description"|"customername"|"approver_name"|"project_manager_name"|"invoice_user_name"|"invoice_supplier"|"invoice_description"|"travel_destination"|"bookingcode"|"approvalstatus"|"bookingstatus"|"invoice_status"|"currency","dateField":"invoicedate|tr_created_at|travel_fromdate|travel_todate","dateFrom":"YYYY-MM-DD|null","dateTo":"YYYY-MM-DD|null","filters":[{"field":"...","operator":"eq|contains|in|gte|lte|is_null|not_null","value":"string|number|boolean|array|null"}],"searchTerms":["short business terms only"],"sortBy":"metric|invoicedate|tr_created_at|travel_fromdate|travel_todate|grossamount|totalnetamount|taxamount|tr_amount|trno|invoiceno|null","sortDirection":"asc|desc","limit":1-20,"amountMin":number|null,"amountMax":number|null}',
    'Rules:',
    '- Use operation="summary" for totals, counts, and high-level questions.',
    '- Use operation="records" for list/show/latest/detail questions.',
    '- Use operation="grouped" for ranking, comparison, top N, or "按...统计" questions.',
    '- If the question asks whether approvals are finished/completed, pending, or still waiting, prefer operation="grouped", groupBy="approvalstatus", metric="reimbursement_count".',
    '- Use scope="mine" for 我/我的/my unless the question explicitly asks for team or all visible.',
    '- If the user mentions a month/date range but does not explicitly say created/submitted/start/end date, prefer dateField="invoicedate".',
    '- Only use tr_created_at when the question explicitly asks about creation/submission time.',
    '- Only use travel_fromdate or travel_todate when the question explicitly asks about travel start/end period.',
    '- searchTerms must be short domain terms only. Never put the whole question into searchTerms.',
    '- Prefer structured filters over searchTerms whenever the field is clear.',
    '- If a field currently has zero non-empty values, do not force a filter on it. Example: if travel_destination has 0 non-empty rows, destination questions should still set groupBy or filter there when asked, but do not invent destination values.',
    '- bookingcode values are short codes. Map natural language expense descriptions to bookingcode using this guide:',
    ...BOOKING_CODE_GUIDE.map((line) => `  - ${line}`),
    '- approvalstatus must use canonical values only. Map natural language to approvalstatus using this guide:',
    ...APPROVAL_STATUS_GUIDE.map((line) => `  - ${line}`),
    '- For "没审批完/审批中/待审批/还没审批完/not approved yet/pending approval", use approvalstatus = "Wait for Approval".',
    '- bookingstatus uses values like OPEN, BOOKED.',
    '- invoice_status uses values like PENDING, SUBMITTED, BOOKED.',
    '- If the user asks "谁的金额最高", usually use operation="grouped", groupBy="tr_user_name", sortBy="metric", sortDirection="desc".',
    '- If the user asks about supplier/vendor, use invoice_supplier.',
    '- Return JSON only.',
  ].join('\n');
}

function describeMetric(metric: OttoMetric, language: 'zh' | 'en'): string {
  if (language === 'en') {
    switch (metric) {
      case 'totalnetamount':
        return 'net amount';
      case 'taxamount':
        return 'tax amount';
      case 'tr_amount':
        return 'reimbursement line amount';
      case 'invoice_count':
        return 'invoice count';
      case 'reimbursement_count':
        return 'reimbursement count';
      case 'line_count':
        return 'line count';
      default:
        return 'gross amount';
    }
  }

  switch (metric) {
    case 'totalnetamount':
      return '未税金额';
    case 'taxamount':
      return '税额';
    case 'tr_amount':
      return '报销行金额';
    case 'invoice_count':
      return '发票数量';
    case 'reimbursement_count':
      return '报销单数量';
    case 'line_count':
      return '明细行数量';
    default:
      return '发票总额';
  }
}

export function buildAnswerPrompt(
  question: string,
  plan: OttoToolInput,
  result: OttoQueryResult,
  metadata: OttoRuntimeMetadata,
): string {
  const language = plan.language;
  const availabilityNote = plan.groupBy
    ? `groupBy=${plan.groupBy}, nonEmpty=${metadata.nonEmptyCounts[plan.groupBy as OttoGroupField] ?? 0}`
    : 'groupBy=null';

  return [
    language === 'en'
      ? 'You are the analysis layer of an enterprise reimbursement and invoice copilot. Answer in polished markdown for a business user, not as raw narration.'
      : '你是企业报销与发票 Copilot 的分析层。请输出面向业务用户的分析结果，不要只是平铺直叙地陈述。',
    language === 'en'
      ? `Use concrete dates. Do not invent values. Metric focus: ${describeMetric(plan.metric, language)}.`
      : `要写清楚具体日期，不要虚构任何值。核心指标：${describeMetric(plan.metric, language)}。`,
    language === 'en'
      ? 'If a requested dimension currently has no non-empty values, say that explicitly.'
      : '如果用户问到的维度当前没有非空数据，要明确说出来。',
    language === 'en'
      ? 'If the direct answer is empty or partially empty, proactively add the closest useful fact from the data, especially invoice counts and amounts when reimbursements do not match the chosen time dimension.'
      : '如果直接答案为空或部分为空，要主动补充最接近用户目标的有用事实。尤其是“没有命中报销单，但同条件下还有多少张发票、多少金额”这类说明，要直接说出来。',
    language === 'en'
      ? 'Your output should look like an analyst dashboard summary: compact KPI bullets, markdown tables should be the default presentation whenever data exists, then 1-3 short insights. Avoid long prose.'
      : '输出要像分析看板摘要：先给 KPI，表格应当作为默认展示形式，只要有数据就优先给 markdown 表格，再给 1-3 条简短洞察。避免大段空话。',
    language === 'en'
      ? 'Preferred structure: ### Answer, ### KPI, ### Breakdown, ### Notes. If groupedRows exist, include a markdown table. If records exist, include a markdown table. Use bullet lists only for KPI or short insights, not as a substitute for tables. If charts are requested or the data is clearly comparative/distribution-oriented, assume chart cards may be rendered separately and mention them briefly.'
      : '优先结构：### 结论、### KPI、### 汇总/明细、### 说明。只要有 groupedRows 或 records，就必须给 markdown 表格。列表只用于 KPI 或简短洞察，不能替代表格。用户要求图表，或数据明显适合对比/分布展示时，可以简短说明图表卡片会一起呈现。',
    language === 'en'
      ? 'When the result contains grouped data, prefer a markdown table over paragraphs. The table should appear even if the narrative answer is already clear.'
      : '只要结果里有分组数据，就优先输出 markdown 表格，不要因为正文已经解释清楚就省略表格。',
    language === 'en'
      ? 'When the result contains record data, prefer a compact markdown detail table instead of narrating records one by one.'
      : '只要结果里有明细数据，就优先输出紧凑的 markdown 明细表，不要逐条口述。',
    language === 'en'
      ? 'Do not output generic recommendations unless they are directly grounded in the current result. Do not repeat the same fact in prose and bullets.'
      : '不要输出泛泛建议，除非它与当前结果直接相关。不要把同一个事实在段落和列表里重复说。',
    `Question: ${question}`,
    `Availability: ${availabilityNote}`,
    JSON.stringify({ plan, result }, null, 2),
  ].join('\n\n');
}

export function buildCardDecisionPrompt(
  question: string,
  plan: OttoToolInput,
  result: OttoQueryResult,
): string {
  return [
    'You are deciding whether charts should be rendered as JSON cards in ORBCAFE AgentUI.',
    'Return JSON only.',
    'This is a business analysis copilot, not a plain chatbot. When the user asks for summary, category breakdown, comparison, share, chart, pie, bar, trend, distribution, top, or ranking, prefer cards aggressively.',
    'Use cards whenever a chart helps understanding comparison, distribution, composition, or trend.',
    'Do not suppress cards just because the answer also contains text.',
    'Tables and cards are complementary: markdown tables should still exist in the textual answer, while cards are used when visual comparison adds value.',
    'Allowed card types: bar-chart-card, pie-chart-card, line-chart-card.',
    'Allowed dimensions: tr_user_name, project_description, customername, approvalstatus, bookingstatus, invoice_status, invoice_supplier, travel_destination, bookingcode, currency.',
    'Allowed metrics: grossamount, totalnetamount, taxamount, tr_amount, invoice_count, reimbursement_count, line_count.',
    'Output shape:',
    '{"showCards":boolean,"cards":[{"type":"bar-chart-card|pie-chart-card|line-chart-card","title":"string","subtitle":"string","dimension":"...","metric":"...","topN":3-10}]}',
    'Rules:',
    '- Keep at most 2 cards.',
    '- Prefer dimension=plan.groupBy when it is available and meaningful.',
    '- If the user explicitly asks for a chart or category summary, normally return showCards=true when there are at least 2 meaningful data points.',
    '- For category share/composition questions, prefer one pie-chart-card and optionally one bar-chart-card.',
    '- For ranking/comparison questions, prefer one bar-chart-card.',
    '- For time trend questions, prefer one line-chart-card.',
    '- If the question is a grouped summary and the grouped rows are suitable for comparison, prefer cards unless the data is too sparse to read.',
    '- If asking only yes/no or status check, usually return showCards=false.',
    `Question: ${question}`,
    JSON.stringify({ plan, aggregate: result.aggregate, groupedRowsSample: result.groupedRows.slice(0, 8) }, null, 2),
  ].join('\n\n');
}
