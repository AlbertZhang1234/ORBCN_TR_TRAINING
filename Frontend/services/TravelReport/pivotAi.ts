import type { PivotAggregation } from 'orbcafe-ui';

export const TR_REPORT_AI_TOOL_NAME = 'apply_tr_report_pivot';

export type TrReportAiStage = 'question_understanding' | 'tool_analysis' | 'tool_execution';

export interface TrReportAiValueConfig {
  fieldId: string;
  aggregation?: PivotAggregation;
}

export interface TrReportAiPlan {
  rows: string[];
  columns: string[];
  filters: string[];
  values: TrReportAiValueConfig[];
  filterSelections: Record<string, string[]>;
  showGrandTotal: boolean;
}

export interface TrReportAiResult {
  toolName: typeof TR_REPORT_AI_TOOL_NAME;
  summary: string;
  plan: TrReportAiPlan;
}

export interface TrReportAiFieldCatalogItem {
  id: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  labelEn: string;
  labelZh: string;
  role: string;
  aliases: string[];
  allowedAggregations?: PivotAggregation[];
}

export const TR_REPORT_AI_FIELD_CATALOG: TrReportAiFieldCatalogItem[] = [
  { id: 'tr_id', type: 'number', labelEn: 'Reimbursement ID', labelZh: '报销单ID', role: 'reimbursement identifier', aliases: ['报销单id', '报销单数', 'reimbursement id', 'count reimbursement'], allowedAggregations: ['count', 'sum', 'avg', 'min', 'max'] },
  { id: 'trno', type: 'string', labelEn: 'Reimbursement No', labelZh: '报销单号', role: 'reimbursement number', aliases: ['报销单号', 'tr号', 'reimbursement no'] },
  { id: 'tr_created_date', type: 'date', labelEn: 'Created Date', labelZh: '创建日期', role: 'created date', aliases: ['创建日期', '提交日期', 'created date', 'submission date'] },
  { id: 'tr_created_month', type: 'string', labelEn: 'Created Month', labelZh: '创建月份', role: 'created month bucket', aliases: ['创建月份', '提交月份', '按月', '每月', 'created month', 'month'] },
  { id: 'tr_userid', type: 'string', labelEn: 'Applicant ID', labelZh: '申请人ID', role: 'applicant userid', aliases: ['申请人id', '报销人账号', 'applicant id'] },
  { id: 'tr_user_name', type: 'string', labelEn: 'Applicant Name', labelZh: '申请人', role: 'applicant name', aliases: ['申请人', '报销人', '员工', '谁', 'applicant', 'employee'] },
  { id: 'tr_projectid', type: 'string', labelEn: 'Project ID', labelZh: '项目ID', role: 'project identifier', aliases: ['项目id', 'project id'] },
  { id: 'project_description', type: 'string', labelEn: 'Project', labelZh: '项目', role: 'project description', aliases: ['项目', '项目名称', '项目描述', 'project'] },
  { id: 'customerid', type: 'string', labelEn: 'Customer ID', labelZh: '客户ID', role: 'customer identifier', aliases: ['客户id', 'customer id'] },
  { id: 'customername', type: 'string', labelEn: 'Customer', labelZh: '客户', role: 'customer name', aliases: ['客户', '客户名称', 'customer'] },
  { id: 'project_manager_userid', type: 'string', labelEn: 'Project Manager ID', labelZh: '项目经理ID', role: 'project manager userid', aliases: ['项目经理id', 'pm id'] },
  { id: 'project_manager_name', type: 'string', labelEn: 'Project Manager', labelZh: '项目经理', role: 'project manager name', aliases: ['项目经理', 'pm', 'project manager'] },
  { id: 'approvalstatus', type: 'string', labelEn: 'Approval Status', labelZh: '审批状态', role: 'reimbursement approval status', aliases: ['审批状态', '报销状态', 'approval status'] },
  { id: 'bookingstatus', type: 'string', labelEn: 'Booking Status', labelZh: '记账状态', role: 'finance booking status', aliases: ['记账状态', '财务状态', 'booking status'] },
  { id: 'approver_userid', type: 'string', labelEn: 'Approver ID', labelZh: '审批人ID', role: 'approver userid', aliases: ['审批人id', 'approver id'] },
  { id: 'approver_name', type: 'string', labelEn: 'Approver', labelZh: '审批人', role: 'approver name', aliases: ['审批人', 'approver'] },
  { id: 'invoiceno', type: 'string', labelEn: 'Invoice No', labelZh: '发票号', role: 'invoice number', aliases: ['发票号', '票号', 'invoice no'] },
  { id: 'invoice_userid', type: 'string', labelEn: 'Invoice User ID', labelZh: '发票所属人ID', role: 'invoice owner userid', aliases: ['发票所属人id', 'invoice user id'] },
  { id: 'invoice_user_name', type: 'string', labelEn: 'Invoice User Name', labelZh: '发票所属人', role: 'invoice owner name', aliases: ['发票所属人', 'invoice user'] },
  { id: 'travelid', type: 'string', labelEn: 'Travel ID', labelZh: '差旅行程ID', role: 'travel entry identifier', aliases: ['差旅id', 'travel id'] },
  { id: 'travel_destination', type: 'string', labelEn: 'Destination', labelZh: '目的地', role: 'travel destination', aliases: ['目的地', '城市', 'destination', 'city'] },
  { id: 'travel_fromdate', type: 'date', labelEn: 'Travel Start Date', labelZh: '出发日期', role: 'travel start date', aliases: ['出发日期', '开始日期', 'travel start'] },
  { id: 'travel_todate', type: 'date', labelEn: 'Travel End Date', labelZh: '结束日期', role: 'travel end date', aliases: ['结束日期', '返回日期', 'travel end'] },
  { id: 'invoicedate', type: 'date', labelEn: 'Invoice Date', labelZh: '发票日期', role: 'invoice date', aliases: ['发票日期', '开票日期', 'invoice date'] },
  { id: 'invoicedate_month', type: 'string', labelEn: 'Invoice Month', labelZh: '开票月份', role: 'invoice month bucket', aliases: ['开票月份', '发票月份', 'invoice month'] },
  { id: 'bookingcode', type: 'string', labelEn: 'Booking Code', labelZh: '费用类别', role: 'expense category code', aliases: ['费用类别', '费用类型', '发票类型', '类别', 'booking code', 'expense type', '停车费', '打车', '高速费', '加油费', '餐饮'] },
  { id: 'currency', type: 'string', labelEn: 'Currency', labelZh: '币种', role: 'currency', aliases: ['币种', 'currency'] },
  { id: 'invoice_status', type: 'string', labelEn: 'Invoice Status', labelZh: '发票状态', role: 'invoice workflow status', aliases: ['发票状态', 'invoice status'] },
  { id: 'invoice_supplier', type: 'string', labelEn: 'Supplier', labelZh: '供应商', role: 'supplier/vendor name', aliases: ['供应商', '商家', 'vendor', 'supplier'] },
  { id: 'invoice_description', type: 'string', labelEn: 'Invoice Description', labelZh: '发票描述', role: 'invoice description', aliases: ['发票描述', '费用说明', 'invoice description'] },
  { id: 'invoice_comment', type: 'string', labelEn: 'Invoice Comment', labelZh: '发票备注', role: 'invoice comment', aliases: ['发票备注', '备注', 'invoice comment'] },
  { id: 'line_trchargeable', type: 'boolean', labelEn: 'TR Chargeable', labelZh: '报销可计费', role: 'reimbursement line chargeable flag', aliases: ['报销可计费', 'tr chargeable'] },
  { id: 'line_txchargeable', type: 'boolean', labelEn: 'TX Chargeable', labelZh: '税额可计费', role: 'tax line chargeable flag', aliases: ['税额可计费', 'tx chargeable'] },
  { id: 'tr_amount', type: 'number', labelEn: 'Reimbursement Amount', labelZh: '报销金额', role: 'reimbursement line amount', aliases: ['报销金额', '报销行金额', 'reimbursement amount'], allowedAggregations: ['sum', 'count', 'avg', 'min', 'max'] },
  { id: 'totalnetamount', type: 'number', labelEn: 'Net Amount', labelZh: '未税金额', role: 'invoice net amount', aliases: ['未税金额', '净额', 'net amount'], allowedAggregations: ['sum', 'count', 'avg', 'min', 'max'] },
  { id: 'taxamount', type: 'number', labelEn: 'Tax Amount', labelZh: '税额', role: 'invoice tax amount', aliases: ['税额', 'tax amount'], allowedAggregations: ['sum', 'count', 'avg', 'min', 'max'] },
  { id: 'grossamount', type: 'number', labelEn: 'Gross Amount', labelZh: '含税总额', role: 'invoice gross amount', aliases: ['含税金额', '总金额', '发票总额', 'gross amount'], allowedAggregations: ['sum', 'count', 'avg', 'min', 'max'] },
];

export const TR_REPORT_AI_ALLOWED_FIELD_IDS = new Set(TR_REPORT_AI_FIELD_CATALOG.map((item) => item.id));

export const TR_REPORT_AI_DEFAULT_PLAN: TrReportAiPlan = {
  rows: ['tr_projectid', 'project_description'],
  columns: ['approvalstatus'],
  filters: ['bookingstatus', 'currency'],
  values: [{ fieldId: 'grossamount', aggregation: 'sum' }],
  filterSelections: {},
  showGrandTotal: true,
};

export function getTrReportAiFieldLabel(fieldId: string, language: 'zh' | 'en'): string {
  const match = TR_REPORT_AI_FIELD_CATALOG.find((item) => item.id === fieldId);
  if (!match) {
    return fieldId;
  }
  return language === 'zh' ? match.labelZh : match.labelEn;
}

export function isTrReportAiFieldId(value: string): boolean {
  return TR_REPORT_AI_ALLOWED_FIELD_IDS.has(String(value ?? '').trim());
}
