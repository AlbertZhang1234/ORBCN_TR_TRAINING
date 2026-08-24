import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { normalizeWorkflowStatus, readFirstExisting } from '@/services/_core/locks';
import { sendEmail } from '@/services/Email/email';
import { requireApiAuth } from '@/services/_server/apiAuth';
import { canAccessReimbursementHeader } from '@/services/TravelReimbursement/access';

interface ReimbursementHeaderRow extends Record<string, unknown> {
  id?: number | string;
  trno?: string;
  userid?: string;
  projectid?: string;
  created_at?: string;
  approvalstatus?: string;
  approval_status?: string;
  approver?: string;
}

interface ReimbursementLineWithInvoiceRow extends Record<string, unknown> {
  invoiceno?: string;
  description?: string;
  travelid?: string;
  tr_amount?: string;
  grossamount?: number | string;
  currency?: string;
  trchargeable?: boolean;
  txchargeable?: boolean;
}

interface ProjectRow extends Record<string, unknown> {
  projectid?: string;
  description?: string;
  projectmanager?: string;
}

interface UserRow extends Record<string, unknown> {
  userid?: string;
  email?: string;
  firstname?: string;
  lastname?: string;
}

const APPROVAL_STATUS_CANDIDATES = ['approvalstatus', 'approval_status'];
const TOKEN_EXPIRE_HOURS = 72;

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

function isHeaderWaitingForApproval(header: ReimbursementHeaderRow): boolean {
  const raw = readFirstExisting(header, APPROVAL_STATUS_CANDIDATES);
  return normalizeWorkflowStatus(raw) === 'WAIT FOR APPROVAL';
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

function ensureHttpBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return '';
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function resolveBaseUrl(request: Request): string {
  const envBase =
    process.env.APPROVAL_ACTION_BASE_URL ||
    process.env.PASSWORD_RESET_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    '';
  const normalizedEnv = ensureHttpBaseUrl(envBase);
  if (normalizedEnv) {
    return normalizedEnv;
  }
  return new URL(request.url).origin;
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

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatAmount(value: unknown): string {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return String(value ?? '');
  }
  return num.toFixed(2);
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const payload = (await request.json()) as {
      reimbursementId?: number | string;
      reimbursementNo?: string;
    };

    const reimbursementId = toNumber(payload?.reimbursementId);
    const reimbursementNo = String(payload?.reimbursementNo ?? '').trim();
    if (!reimbursementId && !reimbursementNo) {
      return NextResponse.json({ message: 'reimbursementId or reimbursementNo is required', requestId }, { status: 400 });
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
      return NextResponse.json({ message: 'Reimbursement not found', requestId }, { status: 404 });
    }

    if (!isHeaderWaitingForApproval(header)) {
      return NextResponse.json(
        { message: 'Reimbursement is not waiting for approval', requestId },
        { status: 400 },
      );
    }

    const headerId = toNumber(header.id);
    if (!headerId) {
      return NextResponse.json({ message: 'Reimbursement id invalid', requestId }, { status: 400 });
    }

    const projectId = readString(header, ['projectid', 'project_id', 'project']);
    if (!projectId) {
      return NextResponse.json({ message: 'projectid missing in reimbursement header', requestId }, { status: 400 });
    }

    const projectRows = await query<ProjectRow>(
      'SELECT projectid, description, projectmanager FROM "otto_project" WHERE projectid = $1 LIMIT 1',
      [projectId],
    );
    const project = projectRows[0];
    if (!project) {
      return NextResponse.json({ message: `Project ${projectId} not found`, requestId }, { status: 404 });
    }

    const projectManager = String(project.projectmanager ?? '').trim();
    if (!canAccessReimbursementHeader(auth, header, projectManager)) {
      return NextResponse.json({ message: 'Forbidden', requestId }, { status: 403 });
    }

    const approverUserId =
      readString(header, ['approver', 'approvalby', 'approvedby']) ||
      readString(project, ['projectmanager', 'project_manager']);
    if (!approverUserId) {
      return NextResponse.json(
        { message: `No approver/projectmanager for project ${projectId}`, requestId },
        { status: 400 },
      );
    }

    const approverRows = await query<UserRow>(
      'SELECT userid, email, firstname, lastname FROM "otto_user" WHERE userid = $1 LIMIT 1',
      [approverUserId],
    );
    const approver = approverRows[0];
    const approverEmail = String(approver?.email ?? '').trim();
    if (!approverEmail) {
      return NextResponse.json(
        { message: `Approver ${approverUserId} has no email`, requestId },
        { status: 400 },
      );
    }

    const applicantRows = await query<UserRow>(
      'SELECT userid, email, firstname, lastname FROM "otto_user" WHERE userid = $1 LIMIT 1',
      [String(header.userid ?? '')],
    );
    const applicant = applicantRows[0];

    const lineRows = await query<ReimbursementLineWithInvoiceRow>(
      `
      SELECT
        t.invoiceno,
        i.description,
        i.travelid,
        i.currency,
        i.grossamount,
        t.tr_amount,
        t.trchargeable,
        t.txchargeable
      FROM "otto_tr_t" t
      LEFT JOIN "otto_invoices" i ON i.invoiceno = t.invoiceno
      WHERE t.id = $1
      ORDER BY t.invoiceno
      `,
      [headerId],
    );

    if (lineRows.length === 0) {
      return NextResponse.json(
        { message: `Reimbursement ${headerId} has no invoice lines`, requestId },
        { status: 400 },
      );
    }

    await ensureTokenTable();
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRE_HOURS * 60 * 60 * 1000);
    await query(
      `INSERT INTO "reimbursement_approval_tokens" (token, reimbursement_id, approver_userid, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [token, headerId, approverUserId, expiresAt.toISOString()],
    );

    const baseUrl = resolveBaseUrl(request);
    const approveUrl = `${baseUrl}/api/reimbursement/approval-action?token=${encodeURIComponent(token)}&action=approved`;
    const rejectUrl = `${baseUrl}/api/reimbursement/approval-action?token=${encodeURIComponent(token)}&action=rejected`;

    const trNo = String(header.trno ?? header.id ?? headerId).trim() || String(headerId);
    const projectLabel = `${projectId}${project.description ? ` - ${project.description}` : ''}`;
    const applicantName =
      [String(applicant?.firstname ?? '').trim(), String(applicant?.lastname ?? '').trim()]
        .filter(Boolean)
        .join(' ') || String(header.userid ?? '').trim();
    const approverName =
      [String(approver?.firstname ?? '').trim(), String(approver?.lastname ?? '').trim()]
        .filter(Boolean)
        .join(' ') || approverUserId;
    const createdAt = String(header.created_at ?? '').trim();

    const total = lineRows.reduce((sum, row) => {
      const amount = Number(row.tr_amount ?? row.grossamount ?? 0);
      return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);
    const currency = String(lineRows[0]?.currency ?? 'CNY').trim() || 'CNY';

    const tableRowsHtml = lineRows
      .map((row) => {
        const invoiceNo = escapeHtml(String(row.invoiceno ?? ''));
        const description = escapeHtml(String(row.description ?? ''));
        const travelId = escapeHtml(String(row.travelid ?? ''));
        const trAmount = escapeHtml(formatAmount(row.tr_amount ?? row.grossamount ?? ''));
        const trChargeable = row.trchargeable ? '是' : '否';
        const txChargeable = row.txchargeable ? '是' : '否';
        return `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${invoiceNo}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${description}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${travelId}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${trAmount}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${trChargeable}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${txChargeable}</td>
          </tr>
        `;
      })
      .join('');

    const html = `
      <div style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;color:#111827;">
        <div style="max-width:920px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 10px 28px rgba(15,23,42,.08);">
          <div style="background:linear-gradient(135deg,#0f172a,#1f2937);padding:20px 24px;color:#ffffff;">
            <div style="font-size:22px;font-weight:700;letter-spacing:.2px;">报销单待审批通知</div>
            <div style="margin-top:6px;font-size:14px;opacity:.9;">TR-${escapeHtml(trNo)}</div>
          </div>
          <div style="padding:22px 24px;">
            <p style="margin:0 0 14px;font-size:15px;">您好 <strong>${escapeHtml(approverName)}</strong>，有一笔新的报销单等待您审批。</p>
            <table style="width:100%;border-collapse:collapse;margin:0 0 14px;">
              <tr><td style="padding:6px 0;color:#6b7280;width:110px;">申请人</td><td style="padding:6px 0;">${escapeHtml(applicantName)}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">项目</td><td style="padding:6px 0;">${escapeHtml(projectLabel)}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">创建时间</td><td style="padding:6px 0;">${escapeHtml(createdAt || new Date().toISOString())}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">发票数</td><td style="padding:6px 0;">${lineRows.length}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">总报销额</td><td style="padding:6px 0;"><strong>${escapeHtml(formatAmount(total))} ${escapeHtml(currency)}</strong></td></tr>
            </table>

            <div style="overflow:auto;border:1px solid #e5e7eb;border-radius:10px;">
              <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead style="background:#f9fafb;">
                  <tr>
                    <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #e5e7eb;">发票号</th>
                    <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #e5e7eb;">描述</th>
                    <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #e5e7eb;">差旅ID</th>
                    <th style="padding:10px 12px;text-align:right;border-bottom:1px solid #e5e7eb;">报销金额</th>
                    <th style="padding:10px 12px;text-align:center;border-bottom:1px solid #e5e7eb;">差旅收费</th>
                    <th style="padding:10px 12px;text-align:center;border-bottom:1px solid #e5e7eb;">补贴收费</th>
                  </tr>
                </thead>
                <tbody>${tableRowsHtml}</tbody>
              </table>
            </div>

            <div style="margin-top:18px;display:flex;gap:10px;">
              <a href="${approveUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600;">通过</a>
              <a href="${rejectUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600;">拒绝</a>
            </div>
            <p style="margin:14px 0 0;color:#6b7280;font-size:12px;">链接有效期 ${TOKEN_EXPIRE_HOURS} 小时，仅可生效一次。点击按钮后会先打开确认页，再执行审批。</p>
          </div>
        </div>
      </div>
    `;

    await sendEmail({
      to: approverEmail,
      subject: `[Approval Required] TR-${trNo} / ${projectId}`,
      html,
    });

    return NextResponse.json({
      status: 'success',
      requestId,
      reimbursementId: headerId,
      approver: approverUserId,
      to: approverEmail,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { message: 'Failed to send approval email', error: message, requestId },
      { status: 500 },
    );
  }
}
