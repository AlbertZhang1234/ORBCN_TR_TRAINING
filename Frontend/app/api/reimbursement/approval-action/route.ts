import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { approveTravelReimbursementOnServer } from '@/services/TravelReimbursement/serverApproval';
import { ServiceError } from '@/services/_core/error';
import { notifyFinanceOfApprovedReimbursement } from '@/services/TravelReimbursement/notifyFinance';
import { financeNotificationDependencies } from '@/services/_server/financeNotificationDependencies';
import { notifyApplicantOfReimbursementDecision } from '@/services/TravelReimbursement/notifyApplicant';

interface ApprovalTokenRow {
  token?: string;
  reimbursement_id?: number | string;
  approver_userid?: string;
  expires_at?: string;
  used_at?: string | null;
}

type ApprovalAction = 'approved' | 'rejected';

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store, max-age=0',
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlPage(title: string, message: string, success: boolean): string {
  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
      </head>
      <body style="margin:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;">
        <div style="max-width:560px;margin:60px auto;padding:0 16px;">
          <div style="background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.08);overflow:hidden;">
            <div style="padding:16px 20px;background:${success ? '#065f46' : '#7f1d1d'};color:#fff;font-size:18px;font-weight:700;">
              ${escapeHtml(title)}
            </div>
            <div style="padding:20px;color:#111827;line-height:1.6;font-size:14px;">
              ${message}
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

function confirmationPage(row: ApprovalTokenRow, action: ApprovalAction): string {
  const reimbursementId = parseHeaderId(row.reimbursement_id);
  const title = action === 'approved' ? '确认审批通过' : '确认审批拒绝';
  const buttonLabel = action === 'approved' ? '确认通过' : '确认拒绝';
  const actionLabel = action === 'approved' ? '通过' : '拒绝';
  const expiresAt = String(row.expires_at ?? '').trim();
  const buttonColor = action === 'approved' ? '#16a34a' : '#dc2626';
  const rejectionField =
    action === 'rejected'
      ? `
                <label style="display:block;margin:0 0 14px;">
                  <span style="display:block;margin:0 0 6px;color:#374151;font-weight:600;">拒绝备注</span>
                  <textarea name="rejectionComment" required rows="5" placeholder="请输入拒绝原因" style="box-sizing:border-box;width:100%;border:1px solid #d1d5db;border-radius:8px;padding:10px 12px;font:inherit;resize:vertical;"></textarea>
                </label>
        `
      : '';

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)}</title>
      </head>
      <body style="margin:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;">
        <div style="max-width:560px;margin:60px auto;padding:0 16px;">
          <div style="background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.08);overflow:hidden;">
            <div style="padding:16px 20px;background:#0f172a;color:#fff;font-size:18px;font-weight:700;">
              ${escapeHtml(title)}
            </div>
            <div style="padding:20px;color:#111827;line-height:1.7;font-size:14px;">
              <p style="margin:0 0 12px;">您即将对报销单 <strong>${escapeHtml(String(reimbursementId ?? '-'))}</strong> 执行“${escapeHtml(actionLabel)}”操作。</p>
              <p style="margin:0 0 12px;">为避免邮件安全扫描误触发，邮件链接只会打开确认页；只有点击下方按钮后才会真正生效。</p>
              <p style="margin:0 0 18px;color:#6b7280;">链接到期时间：${escapeHtml(expiresAt || '-')}</p>
              <form method="post" action="/api/reimbursement/approval-action" style="margin:0;">
                <input type="hidden" name="token" value="${escapeHtml(String(row.token ?? ''))}" />
                <input type="hidden" name="action" value="${escapeHtml(action)}" />
                ${rejectionField}
                <button type="submit" style="appearance:none;border:0;border-radius:8px;background:${buttonColor};color:#fff;padding:11px 18px;font-size:14px;font-weight:600;cursor:pointer;">
                  ${escapeHtml(buttonLabel)}
                </button>
              </form>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

function parseHeaderId(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.trunc(raw);
  }
  if (typeof raw === 'string') {
    const n = Number(raw);
    if (Number.isFinite(n)) {
      return Math.trunc(n);
    }
  }
  return null;
}

async function ensureTokenTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS "reimbursement_approval_tokens" (
      token TEXT PRIMARY KEY,
      reimbursement_id BIGINT NOT NULL,
      approver_userid TEXT NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      used_at TIMESTAMP WITH TIME ZONE,
      used_action TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
}

function parseAction(raw: unknown): ApprovalAction | null {
  const action = String(raw ?? '').trim().toLowerCase();
  if (action === 'approved' || action === 'rejected') {
    return action;
  }
  return null;
}

async function findApprovalToken(token: string): Promise<ApprovalTokenRow | null> {
  const rows = await query<ApprovalTokenRow>(
    'SELECT token, reimbursement_id, approver_userid, expires_at, used_at FROM "reimbursement_approval_tokens" WHERE token = $1 LIMIT 1',
    [token],
  );
  return rows[0] ?? null;
}

async function validateApprovalToken(token: string) {
  await ensureTokenTable();
  const row = await findApprovalToken(token);
  if (!row?.token) {
    return { ok: false as const, status: 404, title: '审批链接无效', message: '该审批链接不存在或已失效。' };
  }

  if (row.used_at) {
    return { ok: false as const, status: 409, title: '审批链接已使用', message: '该链接已被使用，报销单状态可能已经更新。' };
  }

  const expiresAt = Date.parse(String(row.expires_at ?? ''));
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    return { ok: false as const, status: 410, title: '审批链接已过期', message: '该审批链接已过期，请在系统中处理审批。' };
  }

  const reimbursementId = parseHeaderId(row.reimbursement_id);
  const approver = String(row.approver_userid ?? '').trim();
  if (!reimbursementId || !approver) {
    return { ok: false as const, status: 400, title: '审批链接无效', message: '审批链接数据不完整，请联系系统管理员。' };
  }

  return {
    ok: true as const,
    row,
    reimbursementId,
    approver,
  };
}

async function processApproval(token: string, action: ApprovalAction, rejectionComment = '') {
  const validated = await validateApprovalToken(token);
  if (!validated.ok) {
    return new NextResponse(htmlPage(validated.title, validated.message, false), {
      status: validated.status,
      headers: HTML_HEADERS,
    });
  }

  const { reimbursementId, approver } = validated;
  const trimmedRejectionComment = rejectionComment.trim();

  if (action === 'rejected' && !trimmedRejectionComment) {
    return new NextResponse(htmlPage('缺少拒绝备注', '拒绝报销单前必须填写备注。', false), {
      status: 400,
      headers: HTML_HEADERS,
    });
  }

  try {
    const approval = await approveTravelReimbursementOnServer({
      reimbursementId,
      approvalStatus: action,
      approver,
      approvedAt: new Date().toISOString(),
    });

    await query(
      'UPDATE "reimbursement_approval_tokens" SET used_at = NOW(), used_action = $2 WHERE token = $1',
      [token, action],
    );

    if (approval.nextStatus === 'APPROVED' && !approval.wasApproved) {
      try {
        await notifyFinanceOfApprovedReimbursement({ reimbursementId }, financeNotificationDependencies());
      } catch {
        // Do not fail approval result page when finance email sending fails.
      }
    }

    if (approval.nextStatus === 'APPROVED' || approval.nextStatus === 'REJECTED') {
      try {
        await notifyApplicantOfReimbursementDecision({
          reimbursementId,
          approvalStatus: approval.nextStatus === 'APPROVED' ? 'approved' : 'rejected',
          approver,
          rejectionComment: trimmedRejectionComment,
        });
      } catch {
        // Do not fail approval result page when applicant email sending fails.
      }
    }

    const statusLabel = approval.nextStatus === 'APPROVED' ? '已通过' : '已拒绝';
    return new NextResponse(
      htmlPage('审批成功', `报销单 ${reimbursementId} 已${statusLabel}。您现在可以关闭此页面。`, true),
      { status: 200, headers: HTML_HEADERS },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = error instanceof ServiceError && error.status ? error.status : 500;
    const title = status === 409 ? '审批已处理' : '审批失败';
    return new NextResponse(
      htmlPage(title, `处理审批时提示：${escapeHtml(message).replace(/\n/g, '<br/>')}`, false),
      { status, headers: HTML_HEADERS },
    );
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const token = String(requestUrl.searchParams.get('token') ?? '').trim();
  const action = parseAction(requestUrl.searchParams.get('action'));

  if (!token || !action) {
    return new NextResponse(
      htmlPage('审批链接无效', '链接参数错误，请联系系统管理员。', false),
      { status: 400, headers: HTML_HEADERS },
    );
  }

  const validated = await validateApprovalToken(token);
  if (!validated.ok) {
    return new NextResponse(htmlPage(validated.title, validated.message, false), {
      status: validated.status,
      headers: HTML_HEADERS,
    });
  }

  return new NextResponse(confirmationPage(validated.row, action), {
    status: 200,
    headers: HTML_HEADERS,
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = String(formData.get('token') ?? '').trim();
  const action = parseAction(formData.get('action'));
  const rejectionComment = String(formData.get('rejectionComment') ?? '').trim();

  if (!token || !action) {
    return new NextResponse(
      htmlPage('审批链接无效', '链接参数错误，请联系系统管理员。', false),
      { status: 400, headers: HTML_HEADERS },
    );
  }

  return processApproval(token, action, rejectionComment);
}
