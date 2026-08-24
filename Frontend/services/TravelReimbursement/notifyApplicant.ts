import { query } from '@/lib/db';
import { normalizeWorkflowStatus, readFirstExisting } from '@/services/_core/locks';
import { sendEmail } from '@/services/Email/email';

interface ReimbursementHeaderRow extends Record<string, unknown> {
  id?: number | string;
  trno?: string;
  userid?: string;
  projectid?: string;
  approvalstatus?: string;
  approval_status?: string;
  approver?: string;
  approvalby?: string;
  approvedby?: string;
  approvedat?: string;
  approved_at?: string;
  approvalat?: string;
  approval_at?: string;
}

interface UserRow extends Record<string, unknown> {
  userid?: string;
  email?: string;
  firstname?: string;
  lastname?: string;
}

interface ReimbursementLineRow extends Record<string, unknown> {
  tr_amount?: string | number;
}

export type ApplicantNotifyStatus = 'approved' | 'rejected';

const APPROVAL_STATUS_CANDIDATES = ['approvalstatus', 'approval_status'];

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return null;
}

function readString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = String(row[key] ?? '').trim();
    if (value) {
      return value;
    }
  }
  return '';
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isHeaderInExpectedStatus(
  header: ReimbursementHeaderRow,
  expected: ApplicantNotifyStatus,
): boolean {
  const raw = readFirstExisting(header, APPROVAL_STATUS_CANDIDATES);
  const workflow = normalizeWorkflowStatus(raw);
  if (expected === 'approved') {
    return workflow === 'APPROVED';
  }
  return workflow === 'REJECTED';
}

function formatAmount(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return '0.00';
  }
  return n.toFixed(2);
}

export interface NotifyApplicantInput {
  reimbursementId?: number;
  reimbursementNo?: string;
  approvalStatus: ApplicantNotifyStatus;
  approver?: string;
  rejectionComment?: string;
}

export interface NotifyApplicantResult {
  status: 'success';
  reimbursementId: number;
  to: string;
  approvalStatus: ApplicantNotifyStatus;
}

export async function notifyApplicantOfReimbursementDecision(
  input: NotifyApplicantInput,
): Promise<NotifyApplicantResult> {
  const reimbursementId = input.reimbursementId;
  const reimbursementNo = String(input.reimbursementNo ?? '').trim();
  const notifyStatus = input.approvalStatus;
  const approverFromPayload = String(input.approver ?? '').trim();
  const rejectionComment = String(input.rejectionComment ?? '').trim();

  if (!reimbursementId && !reimbursementNo) {
    throw new Error('reimbursementId or reimbursementNo is required');
  }

  const headerRows = reimbursementId
    ? await query<ReimbursementHeaderRow>(
        'SELECT * FROM "otto_tr_h" WHERE id = $1 LIMIT 1',
        [reimbursementId],
      )
    : await query<ReimbursementHeaderRow>(
        'SELECT * FROM "otto_tr_h" WHERE trno = $1 LIMIT 1',
        [reimbursementNo],
      );
  const header = headerRows[0];
  if (!header) {
    throw new Error('Reimbursement not found');
  }

  if (!isHeaderInExpectedStatus(header, notifyStatus)) {
    throw new Error('Reimbursement approval status does not match request');
  }

  const headerId = toNumber(header.id);
  if (!headerId) {
    throw new Error('Reimbursement id invalid');
  }

  const applicantUserId = readString(header, ['userid', 'user_id', 'applicant']);
  if (!applicantUserId) {
    throw new Error('Applicant is missing');
  }

  const applicantRows = await query<UserRow>(
    'SELECT userid, email, firstname, lastname FROM "otto_user" WHERE userid = $1 LIMIT 1',
    [applicantUserId],
  );
  const applicant = applicantRows[0];
  const applicantEmail = String(applicant?.email ?? '').trim();
  if (!applicantEmail) {
    throw new Error(`Applicant ${applicantUserId} has no email`);
  }

  const approverUserId =
    approverFromPayload ||
    readString(header, ['approver', 'approvalby', 'approvedby']) ||
    'N/A';
  const approverRows = approverUserId && approverUserId !== 'N/A'
    ? await query<UserRow>(
        'SELECT userid, firstname, lastname FROM "otto_user" WHERE userid = $1 LIMIT 1',
        [approverUserId],
      )
    : [];
  const approver = approverRows[0];
  const approverName =
    [String(approver?.firstname ?? '').trim(), String(approver?.lastname ?? '').trim()]
      .filter(Boolean)
      .join(' ') || approverUserId;

  const applicantName =
    [String(applicant?.firstname ?? '').trim(), String(applicant?.lastname ?? '').trim()]
      .filter(Boolean)
      .join(' ') || applicantUserId;

  const lineRows = await query<ReimbursementLineRow>(
    'SELECT tr_amount FROM "otto_tr_t" WHERE id = $1',
    [headerId],
  );
  const invoiceCount = lineRows.length;
  const totalAmount = lineRows.reduce((sum, row) => {
    const amount = Number(row.tr_amount ?? 0);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);

  const trNo = String(header.trno ?? header.id ?? headerId).trim() || String(headerId);
  const projectId = readString(header, ['projectid', 'project_id', 'project']);
  const approvedAt = readString(header, ['approvedat', 'approved_at', 'approvalat', 'approval_at']);
  const statusText = notifyStatus === 'approved' ? '已通过' : '已拒绝';
  const rejectionCommentHtml =
    notifyStatus === 'rejected' && rejectionComment
      ? `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top;">拒绝备注</td><td style="padding:6px 0;white-space:pre-wrap;">${escapeHtml(rejectionComment)}</td></tr>`
      : '';

  const subject = `[TR审批结果] TR-${trNo} ${statusText}`;
  const html = `
    <div style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;color:#111827;">
      <div style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
        <div style="background:${notifyStatus === 'approved' ? '#166534' : '#991b1b'};padding:18px 22px;color:#ffffff;">
          <div style="font-size:22px;font-weight:700;">报销单审批结果通知</div>
          <div style="margin-top:4px;font-size:14px;opacity:.9;">TR-${escapeHtml(trNo)}</div>
        </div>
        <div style="padding:20px 22px;">
          <p style="margin:0 0 14px;">您好 <strong>${escapeHtml(applicantName)}</strong>，您的报销单审批结果如下：</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#6b7280;width:120px;">审批结果</td><td style="padding:6px 0;"><strong>${statusText}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">审批人</td><td style="padding:6px 0;">${escapeHtml(approverName)}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">项目</td><td style="padding:6px 0;">${escapeHtml(projectId || '-')}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">发票数量</td><td style="padding:6px 0;">${invoiceCount}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">报销总额</td><td style="padding:6px 0;">${escapeHtml(formatAmount(totalAmount))}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">审批时间</td><td style="padding:6px 0;">${escapeHtml(approvedAt || new Date().toISOString())}</td></tr>
            ${rejectionCommentHtml}
          </table>
        </div>
      </div>
    </div>
  `;

  const text = [
    `您好 ${applicantName}，`,
    `您的报销单 TR-${trNo} 审批结果：${statusText}`,
    `审批人：${approverName}`,
    `项目：${projectId || '-'}`,
    `发票数量：${invoiceCount}`,
    `报销总额：${formatAmount(totalAmount)}`,
    `审批时间：${approvedAt || new Date().toISOString()}`,
    ...(notifyStatus === 'rejected' && rejectionComment ? [`拒绝备注：${rejectionComment}`] : []),
  ].join('\n');

  await sendEmail({
    to: applicantEmail,
    subject,
    text,
    html,
  });

  return {
    status: 'success',
    reimbursementId: headerId,
    to: applicantEmail,
    approvalStatus: notifyStatus,
  };
}
