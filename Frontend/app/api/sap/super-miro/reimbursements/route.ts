import { NextResponse } from 'next/server';

import { ServiceError } from '@/services/_core/error';
import { requireApiAuth } from '@/services/_server/apiAuth';
import { createSuperMiroReimbursementDependencies } from '@/services/_server/superMiroReimbursementDependencies';
import {
  postType03ReimbursementsToSuperMiro,
  type SuperMiroReimbursementReference,
} from '@/services/Sap/superMiro';

export const runtime = 'nodejs';

function parseReferences(body: unknown): SuperMiroReimbursementReference[] {
  if (!body || typeof body !== 'object' || !Array.isArray((body as Record<string, unknown>).reimbursements)) {
    throw new ServiceError('reimbursements must be an array', { status: 400 });
  }
  const reimbursements = (body as { reimbursements: unknown[] }).reimbursements;
  const language = (body as { language?: unknown }).language === 'en' ? 'en' : 'zh';
  if (reimbursements.length > 50) {
    throw new ServiceError('At most 50 reimbursements can be posted at once', { status: 400 });
  }
  return reimbursements.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new ServiceError('Each reimbursement reference must be an object', { status: 400 });
    }
    const reference = item as Record<string, unknown>;
    return {
      id: reference.id as number | string | undefined,
      trno: String(reference.trno ?? '').trim() || undefined,
      language,
    };
  });
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }
    if (!auth.permissions.isFinance && !auth.permissions.isAdmin) {
      return NextResponse.json({ message: 'Only finance or admin can post reimbursements to SAP' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ServiceError('Request body must be valid JSON', { status: 400 });
    }

    const result = await postType03ReimbursementsToSuperMiro(
      parseReferences(body),
      createSuperMiroReimbursementDependencies(),
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const status = error instanceof ServiceError && error.status ? error.status : 500;
    const message = error instanceof Error ? error.message : 'SAP reimbursement posting failed';
    return NextResponse.json({ message }, { status });
  }
}
