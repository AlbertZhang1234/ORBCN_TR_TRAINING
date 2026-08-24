import type { OttoField, OttoGroupField, OttoMetric, OttoToolInput } from './ottoVTrAllTool';

export interface OttoFieldDefinition {
  type: 'text' | 'number' | 'date' | 'timestamp' | 'boolean' | 'id';
  searchable?: boolean;
  groupable?: boolean;
  sortable?: boolean;
}

export const FIELD_DEFINITIONS: Record<OttoField, OttoFieldDefinition> = {
  tr_id: { type: 'id', sortable: true },
  trno: { type: 'text', searchable: true, sortable: true },
  tr_created_at: { type: 'timestamp', sortable: true },
  tr_userid: { type: 'text', searchable: true },
  tr_user_name: { type: 'text', searchable: true, groupable: true },
  tr_projectid: { type: 'text', searchable: true },
  project_description: { type: 'text', searchable: true, groupable: true },
  project_manager_userid: { type: 'text', searchable: true },
  project_manager_name: { type: 'text', searchable: true, groupable: true },
  customerid: { type: 'text', searchable: true },
  customername: { type: 'text', searchable: true, groupable: true },
  approvalstatus: { type: 'text', searchable: true, groupable: true },
  bookingstatus: { type: 'text', searchable: true, groupable: true },
  approver_userid: { type: 'text', searchable: true },
  approver_name: { type: 'text', searchable: true, groupable: true },
  invoiceno: { type: 'text', searchable: true, sortable: true },
  tr_amount: { type: 'number', sortable: true },
  line_trchargeable: { type: 'boolean' },
  line_txchargeable: { type: 'boolean' },
  invoice_userid: { type: 'text', searchable: true },
  invoice_user_name: { type: 'text', searchable: true, groupable: true },
  travelid: { type: 'text', searchable: true },
  travel_fromdate: { type: 'date', sortable: true },
  travel_todate: { type: 'date', sortable: true },
  travel_destination: { type: 'text', searchable: true },
  invoicedate: { type: 'date', sortable: true },
  totalnetamount: { type: 'number', sortable: true },
  taxamount: { type: 'number', sortable: true },
  grossamount: { type: 'number', sortable: true },
  bookingcode: { type: 'text', searchable: true, groupable: true },
  currency: { type: 'text', searchable: true, groupable: true },
  invoice_status: { type: 'text', searchable: true, groupable: true },
  invoice_comment: { type: 'text', searchable: true },
  invoice_description: { type: 'text', searchable: true, groupable: true },
  invoice_supplier: { type: 'text', searchable: true, groupable: true },
};

export const GROUP_FIELDS: OttoGroupField[] = [
  'tr_user_name',
  'project_description',
  'customername',
  'approver_name',
  'project_manager_name',
  'invoice_user_name',
  'invoice_supplier',
  'invoice_description',
  'travel_destination',
  'bookingcode',
  'approvalstatus',
  'bookingstatus',
  'invoice_status',
  'currency',
];

export const SEARCHABLE_FIELDS: OttoField[] = Object.entries(FIELD_DEFINITIONS)
  .filter(([, def]) => def.searchable)
  .map(([field]) => field as OttoField);

export const VALUE_HINT_FIELDS: OttoField[] = [
  'tr_user_name',
  'project_description',
  'customername',
  'approver_name',
  'project_manager_name',
  'invoice_user_name',
  'bookingcode',
  'approvalstatus',
  'bookingstatus',
  'invoice_status',
  'currency',
  'invoice_supplier',
  'travel_destination',
];

export const METRIC_TO_SQL: Record<Exclude<OttoMetric, 'invoice_count' | 'reimbursement_count' | 'line_count'>, string> = {
  grossamount: 'COALESCE("grossamount", 0)',
  totalnetamount: 'COALESCE("totalnetamount", 0)',
  taxamount: 'COALESCE("taxamount", 0)',
  tr_amount: 'COALESCE("tr_amount", 0)',
};

export const DEFAULT_TOOL_INPUT: OttoToolInput = {
  language: 'zh',
  operation: 'summary',
  metric: 'grossamount',
  scope: 'mine',
  groupBy: null,
  dateField: 'invoicedate',
  dateFrom: null,
  dateTo: null,
  filters: [],
  searchTerms: [],
  sortBy: 'metric',
  sortDirection: 'desc',
  limit: 8,
  amountMin: null,
  amountMax: null,
};

export const STOP_TERMS = new Set([
  '我', '我的', '一下', '查询', '查一下', '看一下', '看看', '多少', '什么', '哪些', '列出', '最近', '最新',
  '报销', '报销单', '发票', '金额', '总额', '总金额', '统计', '情况', '数据', '信息', '记录', 'the', 'my',
  'show', 'list', 'latest', 'recent', 'find', 'query', 'amount', 'invoice', 'reimbursement', 'record', 'records',
  'booking', 'code', 'approval', 'wait', 'for',
]);

export const STATUS_NORMALIZERS = {
  approval: new Map<string, string>([
    ['approved', 'APPROVED'],
    ['通过', 'APPROVED'],
    ['已通过', 'APPROVED'],
    ['审批通过', 'APPROVED'],
    ['批准通过', 'APPROVED'],
    ['rejected', 'REJECTED'],
    ['拒绝', 'REJECTED'],
    ['驳回', 'REJECTED'],
    ['已拒绝', 'REJECTED'],
    ['wait for approval', 'Wait for Approval'],
    ['waiting', 'Wait for Approval'],
    ['pending approval', 'Wait for Approval'],
    ['awaiting approval', 'Wait for Approval'],
    ['待审批', 'Wait for Approval'],
    ['待批准', 'Wait for Approval'],
    ['待审核', 'Wait for Approval'],
    ['审核中', 'Wait for Approval'],
    ['审批中', 'Wait for Approval'],
    ['审批未完成', 'Wait for Approval'],
    ['未完成审批', 'Wait for Approval'],
    ['审批没完成', 'Wait for Approval'],
    ['没审批完', 'Wait for Approval'],
    ['未审批完', 'Wait for Approval'],
    ['还没审批完', 'Wait for Approval'],
    ['审批还没完', 'Wait for Approval'],
    ['not approved yet', 'Wait for Approval'],
    ['not fully approved', 'Wait for Approval'],
    ['still waiting', 'Wait for Approval'],
    ['submitted', 'Wait for Approval'],
    ['已提交', 'Wait for Approval'],
  ]),
  booking: new Map<string, string>([
    ['open', 'OPEN'],
    ['未记账', 'OPEN'],
    ['open items', 'OPEN'],
    ['booked', 'BOOKED'],
    ['已记账', 'BOOKED'],
    ['已入账', 'BOOKED'],
  ]),
  invoice: new Map<string, string>([
    ['pending', 'PENDING'],
    ['待处理', 'PENDING'],
    ['submitted', 'SUBMITTED'],
    ['已提交', 'SUBMITTED'],
    ['booked', 'BOOKED'],
    ['已记账', 'BOOKED'],
  ]),
};

export const BOOKING_CODE_HINTS: Array<{ code: string; aliases: string[] }> = [
  { code: 'PARK', aliases: ['park', 'parking', '停车', '停车费', '停车场', '车位'] },
  { code: 'TAXI', aliases: ['taxi', 'uber', 'didi', 'ride hailing', 'ride-hailing', '打车', '出租车', '网约车', '滴滴', '代驾', '快车', '专车'] },
  { code: 'AUTG', aliases: ['autg', 'highway', 'toll', 'bridge fee', 'etc', '高速', '高速费', '过路', '过路费', '过桥', '过桥费', '路桥'] },
  { code: 'BENL', aliases: ['benl', 'fuel', 'petrol', 'gasoline', 'diesel', '加油', '加油费', '燃油', '汽油', '柴油'] },
  { code: 'BEWI', aliases: ['bewi', 'meal', 'meals', 'dining', 'restaurant', 'hospitality', '餐饮', '吃饭', '工作餐', '饭店', '餐厅', '招待'] },
  { code: 'SOBE', aliases: ['sobe', 'misc', 'miscellaneous', '杂项', '未分类', '无法识别'] },
] as const;
