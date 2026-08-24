import { NextResponse } from 'next/server';
import { ServiceError } from '../../../../services/_core/error';
import { loadRequestAuthContext } from '../../../../services/_server/requestAuth';
import { listTravelReportRowsForAccess, resolveTravelReportAccess } from '../../../../services/TravelReport/server';

export const runtime = 'nodejs';

interface TravelReportViewRequestBody {
  requestUserId?: string;
}

function toText(value: unknown): string {
  return String(value ?? '').trim();
}

export async function POST(request: Request) {
  try {
    const auth = await loadRequestAuthContext(request);

    let body: TravelReportViewRequestBody = {};
    try {
      body = (await request.json()) as TravelReportViewRequestBody;
    } catch {
      body = {};
    }

    const access = resolveTravelReportAccess(auth, toText(body.requestUserId));
    const rows = await listTravelReportRowsForAccess(access);
    return NextResponse.json({
      requestUserId: access.requestUserId,
      canViewAll: access.canViewAll,
      rows,
    });
  } catch (error) {
    const status = error instanceof ServiceError && error.status ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return NextResponse.json({ message }, { status });
  }
}
