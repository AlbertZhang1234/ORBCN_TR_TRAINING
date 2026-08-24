export const TABLES = {
  customer: 'otto_customer',
  project: 'otto_project',
  travelEntry: 'otto_travelentry',
  invoice: 'otto_invoices',
  reimbursementHeader: 'otto_tr_h',
  reimbursementLine: 'otto_tr_t',
  reimbursementReportView: 'otto_v_tr_all',
  user: 'otto_user',
  role: 'otto_role',
  userRole: 'otto_userrole',
  loginSession: 't_loginsessions',
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];
