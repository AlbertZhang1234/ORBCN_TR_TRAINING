import path from 'path';
import { readdir, readFile } from 'fs/promises';

import { normalizeWorkflowStatus, readFirstExisting } from '@/services/_core/locks';
import { query } from '@/lib/db';
import { getResolvedSmtpConfig } from '@/services/Email/config';
import { sendEmail } from '@/services/Email/email';

interface ReimbursementHeaderRow extends Record<string, unknown> {
  id?: number;
  trno?: string;
  userid?: string;
  approvalstatus?: string;
  approval_status?: string;
}

interface ReimbursementLineRow extends Record<string, unknown> {
  id?: number;
  invoiceno?: string;
}

const APPROVAL_STATUS_CANDIDATES = ['approvalstatus', 'approval_status'];
const DEFAULT_TR_RECEIVER = 'financechina@orbis-group.com';

function sanitizeFileBaseName(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
}

function buildSubject(header: ReimbursementHeaderRow): string {
  const rawNo = String(header.trno ?? header.id ?? '').trim();
  const normalized = rawNo.replace(/^TR/i, '').trim();
  return normalized || rawNo || 'UNKNOWN';
}

function isHeaderApproved(header: ReimbursementHeaderRow): boolean {
  const raw = readFirstExisting(header, APPROVAL_STATUS_CANDIDATES);
  return normalizeWorkflowStatus(raw) === 'APPROVED';
}

async function findInvoiceFiles(
  invoiceNos: string[],
  dataDir: string,
): Promise<{
  attachments: { filename: string; content: Buffer }[];
  missing: string[];
}> {
  const entries = await readdir(dataDir).catch(() => []);
  const fileMap = new Map<string, string>();
  for (const name of entries) {
    const base = path.parse(name).name;
    if (!fileMap.has(base)) {
      fileMap.set(base, name);
    }
  }

  const missing: string[] = [];
  const attachments: { filename: string; content: Buffer }[] = [];
  for (const invoiceNo of invoiceNos) {
    const safeBase = sanitizeFileBaseName(invoiceNo);
    const fileName = fileMap.get(safeBase);
    if (!fileName) {
      missing.push(invoiceNo);
      continue;
    }
    const filePath = path.join(dataDir, fileName);
    const content = await readFile(filePath);
    attachments.push({ filename: fileName, content });
  }

  return { attachments, missing };
}

export interface NotifyFinanceInput {
  reimbursementId?: number;
  reimbursementNo?: string;
}

export interface NotifyFinanceResult {
  status: 'success';
  messageId: string;
  attachmentsCount: number;
  missing: string[];
}

export async function notifyFinanceOfApprovedReimbursement(
  input: NotifyFinanceInput,
): Promise<NotifyFinanceResult> {
  const reimbursementId = input.reimbursementId;
  const reimbursementNo = String(input.reimbursementNo ?? '').trim() || undefined;

  if (!reimbursementId && !reimbursementNo) {
    throw new Error('reimbursementId or reimbursementNo is required');
  }

  const headers = reimbursementId
    ? await query<ReimbursementHeaderRow>(
        'SELECT id, trno, userid, approvalstatus FROM "otto_tr_h" WHERE id = $1 LIMIT 1',
        [reimbursementId],
      )
    : await query<ReimbursementHeaderRow>(
        'SELECT id, trno, userid, approvalstatus FROM "otto_tr_h" WHERE trno = $1 LIMIT 1',
        [reimbursementNo],
      );
  const header = headers[0];
  if (!header) {
    throw new Error('Reimbursement not found');
  }

  if (!isHeaderApproved(header)) {
    throw new Error('Reimbursement is not approved');
  }

  const headerId = typeof header.id === 'number' ? header.id : reimbursementId;
  if (!headerId) {
    throw new Error('Reimbursement id is missing');
  }

  const lineRows = await query<ReimbursementLineRow>(
    'SELECT id, invoiceno FROM "otto_tr_t" WHERE id = $1',
    [headerId],
  );
  const invoiceNos = Array.from(
    new Set(lineRows.map((row) => String(row.invoiceno ?? '').trim()).filter((x) => x.length > 0)),
  );

  if (invoiceNos.length === 0) {
    throw new Error('No invoices found for reimbursement');
  }

  const dataDir = path.join(process.cwd(), 'data');
  const { attachments, missing } = await findInvoiceFiles(invoiceNos, dataDir);
  const smtpConfig = getResolvedSmtpConfig();

  const to = smtpConfig.to ?? DEFAULT_TR_RECEIVER;
  const subject = buildSubject(header);

  const invoiceListHtml = invoiceNos
    .map((inv) => {
      const isMissing = missing.includes(inv);
      return `<li style="${isMissing ? 'color: red;' : ''}">${inv} ${isMissing ? '(File Missing)' : ''}</li>`;
    })
    .join('');

  const html = `
    <div style="font-family: sans-serif; color: #333;">
      <h2>Reimbursement Approved</h2>
      <p><strong>TR No:</strong> ${subject}</p>
      <p><strong>Applicant:</strong> ${header.userid || 'Unknown'}</p>
      <p><strong>Status:</strong> APPROVED</p>
      <hr />
      <h3>Invoices</h3>
      <ul>
        ${invoiceListHtml}
      </ul>
      ${
        missing.length > 0
          ? `<p style="color: red; font-weight: bold;">Warning: Source files for the following invoices are missing: ${missing.join(', ')}</p>`
          : ''
      }
      <p>Please find the invoice source files attached.</p>
    </div>
  `;

  const info = await sendEmail({
    to,
    subject,
    html,
    attachments,
  });

  return {
    status: 'success',
    messageId: info.messageId,
    attachmentsCount: attachments.length,
    missing,
  };
}
