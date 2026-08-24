import { NextResponse } from 'next/server';
import { approveTravelReimbursementOnServer } from '@/services/TravelReimbursement/serverApproval';
import { ServiceError } from '@/services/_core/error';
import { requireApiAuth } from '@/services/_server/apiAuth';
import { canActAsApprover } from '@/services/TravelReimbursement/access';
import { notifyFinanceOfApprovedReimbursement } from '@/services/TravelReimbursement/notifyFinance';
import { notifyApplicantOfReimbursementDecision } from '@/services/TravelReimbursement/notifyApplicant';

interface ApprovePayload {
  reimbursementId?: number | string;
  reimbursementNo?: string;
  approvalStatus?: 'approved' | 'rejected' | 'open' | 'wait for approval';
  approver?: string;
  approvedAt?: string;
  rejectionComment?: string;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return undefined;
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const payload = (await request.json()) as ApprovePayload;
    const reimbursementId = toNumber(payload?.reimbursementId);
    const reimbursementNo = String(payload?.reimbursementNo ?? '').trim() || undefined;
    const approvalStatus = payload?.approvalStatus;
    const approver = String(payload?.approver ?? '').trim();
    const rejectionComment = String(payload?.rejectionComment ?? '').trim();

    if (!approvalStatus) {
      return NextResponse.json({ message: 'approvalStatus is required' }, { status: 400 });
    }
    if (!approver) {
      return NextResponse.json({ message: 'approver is required' }, { status: 400 });
    }
    if (String(approvalStatus).trim().toLowerCase() === 'rejected' && !rejectionComment) {
      return NextResponse.json({ message: 'rejectionComment is required' }, { status: 400 });
    }
    if (!reimbursementId && !reimbursementNo) {
      return NextResponse.json(
        { message: 'reimbursementId or reimbursementNo is required' },
        { status: 400 },
      );
    }

    if (!canActAsApprover(auth, approver)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const result = await approveTravelReimbursementOnServer({
      reimbursementId,
      reimbursementNo,
      approvalStatus,
      approver,
      approvedAt: payload?.approvedAt,
    });

    const headerId =
      typeof result.header.id === 'number'
        ? result.header.id
        : Number.isFinite(Number(result.header.id))
          ? Number(result.header.id)
          : reimbursementId;

    if (result.nextStatus === 'APPROVED' && !result.wasApproved && headerId) {
      try {
        await notifyFinanceOfApprovedReimbursement({ reimbursementId: headerId });
      } catch {
        // Keep approval result successful even when email fails.
      }
    }

    if ((result.nextStatus === 'APPROVED' || result.nextStatus === 'REJECTED') && headerId) {
      try {
        await notifyApplicantOfReimbursementDecision({
          reimbursementId: headerId,
          approvalStatus: result.nextStatus === 'APPROVED' ? 'approved' : 'rejected',
          approver,
          rejectionComment,
        });
      } catch {
        // Keep approval result successful even when email fails.
      }
    }

    return NextResponse.json(
      {
        header: result.header,
        wasApproved: result.wasApproved,
        nextStatus: result.nextStatus,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to approve reimbursement';
    const status = error instanceof ServiceError && error.status ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}
