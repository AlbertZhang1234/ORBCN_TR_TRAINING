import type { OttoToolInput } from './ottoVTrAllTool';

function startOfMonth(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function endOfMonth(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

export function maybeApplyMonthRange(question: string, plan: OttoToolInput): void {
  const now = new Date();
  if (/(上个月|last month)/i.test(question)) {
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    plan.dateFrom = startOfMonth(lastMonth);
    plan.dateTo = endOfMonth(lastMonth);
    return;
  }
  if (/(这个月|本月|this month|current month)/i.test(question)) {
    plan.dateFrom = startOfMonth(now);
    plan.dateTo = endOfMonth(now);
    return;
  }
  if (/(去年|last year)/i.test(question)) {
    plan.dateFrom = `${now.getUTCFullYear() - 1}-01-01`;
    plan.dateTo = `${now.getUTCFullYear() - 1}-12-31`;
    return;
  }
  if (/(今年|this year|current year)/i.test(question)) {
    plan.dateFrom = `${now.getUTCFullYear()}-01-01`;
    plan.dateTo = `${now.getUTCFullYear()}-12-31`;
    return;
  }

  const zhMonth = question.match(/(20\d{2})年\s*(\d{1,2})月/);
  if (zhMonth) {
    const year = Number(zhMonth[1]);
    const month = Number(zhMonth[2]);
    const date = new Date(Date.UTC(year, month - 1, 1));
    plan.dateFrom = startOfMonth(date);
    plan.dateTo = endOfMonth(date);
    return;
  }

  const isoMonth = question.match(/(20\d{2})-(\d{2})(?!-\d{2})/);
  if (isoMonth) {
    const year = Number(isoMonth[1]);
    const month = Number(isoMonth[2]);
    const date = new Date(Date.UTC(year, month - 1, 1));
    plan.dateFrom = startOfMonth(date);
    plan.dateTo = endOfMonth(date);
    return;
  }

  const impliedMonth = question.match(/(^|[^0-9])(\d{1,2})月(份)?/);
  if (impliedMonth) {
    const month = Number(impliedMonth[2]);
    if (month >= 1 && month <= 12) {
      const date = new Date(Date.UTC(now.getUTCFullYear(), month - 1, 1));
      plan.dateFrom = startOfMonth(date);
      plan.dateTo = endOfMonth(date);
    }
  }
}

function hasImplicitDateRange(question: string): boolean {
  return (
    /(上个月|last month|这个月|本月|this month|current month|去年|last year|今年|this year|current year)/i.test(question) ||
    /(20\d{2})年\s*(\d{1,2})月/.test(question) ||
    /(20\d{2})-(\d{2})(?!-\d{2})/.test(question) ||
    /(^|[^0-9])(\d{1,2})月(份)?/.test(question)
  );
}

function inferExplicitDateField(question: string): OttoToolInput['dateField'] | null {
  if (/(创建时间|创建日期|提交时间|提交日期|录入时间|created at|created time|submission time|submitted at)/i.test(question)) {
    return 'tr_created_at';
  }
  if (/(出发时间|出发日期|开始时间|开始日期|行程开始|travel start|departure date|from date|start date)/i.test(question)) {
    return 'travel_fromdate';
  }
  if (/(结束时间|结束日期|返程时间|返程日期|到达时间|到达日期|行程结束|travel end|return date|to date|end date)/i.test(question)) {
    return 'travel_todate';
  }
  if (/(发票日期|开票日期|invoice date)/i.test(question)) {
    return 'invoicedate';
  }
  return null;
}

function isApprovalCompletionQuestion(question: string): boolean {
  return /(审批完|批完|审批完成|批复完成|都批了|都审批了|还有.*待审批|有没有.*待审批|未审批|没审批完|未审批完|审批还没完|审批中|pending approval|approval complete|fully approved|still waiting)/i.test(
    question,
  );
}

function isPendingApprovalQuestion(question: string): boolean {
  return /(待审批|待批准|待审核|审核中|审批中|未审批|没审批完|未审批完|还没审批完|审批还没完|pending approval|awaiting approval|not approved yet|still waiting)/i.test(
    question,
  );
}

export function applyQuestionHeuristics(question: string, plan: OttoToolInput): OttoToolInput {
  const next: OttoToolInput = {
    ...plan,
    filters: [...plan.filters],
    searchTerms: [...plan.searchTerms],
  };

  const explicitDateField = inferExplicitDateField(question);
  if (explicitDateField) {
    next.dateField = explicitDateField;
  } else if (hasImplicitDateRange(question)) {
    next.dateField = 'invoicedate';
  }

  if (isApprovalCompletionQuestion(question)) {
    next.operation = 'grouped';
    next.groupBy = 'approvalstatus';
    next.metric = 'reimbursement_count';
    next.sortBy = 'metric';
    next.sortDirection = 'desc';
    next.limit = Math.max(next.limit, 5);
  }

  if (isPendingApprovalQuestion(question)) {
    if (!next.filters.some((filter) => filter.field === 'approvalstatus')) {
      next.filters.push({
        field: 'approvalstatus',
        operator: 'eq',
        value: 'Wait for Approval',
      });
    }
    if (/(哪些|什么|还有|list|show|明细|记录|单子|单据)/i.test(question)) {
      next.operation = 'records';
      next.sortBy = 'tr_created_at';
      next.sortDirection = 'desc';
      next.limit = Math.max(next.limit, 8);
    }
  }

  return next;
}
