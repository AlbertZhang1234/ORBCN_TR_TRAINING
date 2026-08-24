import { NextResponse } from 'next/server';

import { query } from '@/lib/db';
import { requireApiAuth } from '@/services/_server/apiAuth';
import { canAccessReimbursementHeader, readRowString } from '@/services/TravelReimbursement/access';
import { notifyFinanceOfApprovedReimbursement } from '@/services/TravelReimbursement/notifyFinance';

interface ReimbursementHeaderRow extends Record<string, unknown> {
  id?: number;
  trno?: string;
  userid?: string;
  projectid?: string;
  approver?: string;
  approvalby?: string;
  approvedby?: string;
}

interface ProjectRow extends Record<string, unknown> {
  projectmanager?: string;
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const payload = await request.json();
    const reimbursementId =
      typeof payload?.reimbursementId === 'number'
        ? payload.reimbursementId
        : Number.isFinite(Number(payload?.reimbursementId))
          ? Number(payload.reimbursementId)
          : undefined;
    const reimbursementNo = String(payload?.reimbursementNo ?? '').trim() || undefined;

    if (!reimbursementId && !reimbursementNo) {
      return NextResponse.json(
        { message: 'reimbursementId or reimbursementNo is required', requestId },
        { status: 400 },
      );
    }

    const headers = reimbursementId
      ? await query<ReimbursementHeaderRow>(
          'SELECT id, trno, userid, projectid, approver, approvalby, approvedby FROM "otto_tr_h" WHERE id = $1 LIMIT 1',
          [reimbursementId],
        )
      : await query<ReimbursementHeaderRow>(
          'SELECT id, trno, userid, projectid, approver, approvalby, approvedby FROM "otto_tr_h" WHERE trno = $1 LIMIT 1',
          [reimbursementNo],
        );
    const header = headers[0];
    if (!header) {
      return NextResponse.json({ message: 'Reimbursement not found', requestId }, { status: 404 });
    }

    const projectId = readRowString(header, ['projectid', 'project_id', 'project']);
    const projects = projectId
      ? await query<ProjectRow>(
          'SELECT projectmanager FROM "otto_project" WHERE projectid = $1 LIMIT 1',
          [projectId],
        )
      : [];
    const projectManager = String(projects[0]?.projectmanager ?? '').trim();

    if (!canAccessReimbursementHeader(auth, header, projectManager)) {
      return NextResponse.json({ message: 'Forbidden', requestId }, { status: 403 });
    }

    const result = await notifyFinanceOfApprovedReimbursement({
      reimbursementId,
      reimbursementNo,
    });

    return NextResponse.json({ ...result, requestId }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send notification';
    return NextResponse.json(
      { message: 'Failed to send notification', error: message, requestId },
      { status: 500 },
    );
  }
}
