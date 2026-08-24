import { NextResponse } from 'next/server';

import { query } from '@/lib/db';
import { requireApiAuth } from '@/services/_server/apiAuth';
import { canAccessReimbursementHeader, readRowString } from '@/services/TravelReimbursement/access';
import {
  notifyApplicantOfReimbursementDecision,
  type ApplicantNotifyStatus,
} from '@/services/TravelReimbursement/notifyApplicant';

interface ReimbursementHeaderRow extends Record<string, unknown> {
  id?: number | string;
  userid?: string;
  projectid?: string;
  approver?: string;
  approvalby?: string;
  approvedby?: string;
}

interface ProjectRow extends Record<string, unknown> {
  projectmanager?: string;
}

function normalizeNotifyStatus(value: unknown): ApplicantNotifyStatus | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'approved') {
    return 'approved';
  }
  if (normalized === 'rejected') {
    return 'rejected';
  }
  return null;
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
      approvalStatus?: string;
      approver?: string;
    };

    const reimbursementId =
      typeof payload?.reimbursementId === 'number'
        ? Math.trunc(payload.reimbursementId)
        : Number.isFinite(Number(payload?.reimbursementId))
          ? Math.trunc(Number(payload.reimbursementId))
          : undefined;
    const reimbursementNo = String(payload?.reimbursementNo ?? '').trim() || undefined;
    const approvalStatus = normalizeNotifyStatus(payload?.approvalStatus);

    if (!reimbursementId && !reimbursementNo) {
      return NextResponse.json(
        { message: 'reimbursementId or reimbursementNo is required', requestId },
        { status: 400 },
      );
    }
    if (!approvalStatus) {
      return NextResponse.json(
        { message: 'approvalStatus must be approved or rejected', requestId },
        { status: 400 },
      );
    }

    const headers = reimbursementId
      ? await query<ReimbursementHeaderRow>(
          'SELECT id, userid, projectid, approver, approvalby, approvedby FROM "otto_tr_h" WHERE id = $1 LIMIT 1',
          [reimbursementId],
        )
      : await query<ReimbursementHeaderRow>(
          'SELECT id, userid, projectid, approver, approvalby, approvedby FROM "otto_tr_h" WHERE trno = $1 LIMIT 1',
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

    const result = await notifyApplicantOfReimbursementDecision({
      reimbursementId,
      reimbursementNo,
      approvalStatus,
      approver: payload.approver,
    });

    return NextResponse.json({ ...result, requestId }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to notify applicant';
    return NextResponse.json(
      { message: 'Failed to notify applicant', error: message, requestId },
      { status: 500 },
    );
  }
}
