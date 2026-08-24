import { getSessionId } from '../../app/pc/_components/session';
import { ServiceError } from '../_core/error';
import type { TravelReportRow } from './_shared';

interface TravelReportViewResponse {
  rows?: TravelReportRow[];
  message?: string;
}

export type { TravelReportRow } from './_shared';

export async function listTravelReportRows(requestUserId: string): Promise<TravelReportRow[]> {
  const normalizedRequestUserId = String(requestUserId ?? '').trim();
  if (!normalizedRequestUserId) {
    throw new ServiceError('requestUserId is required');
  }

  const sessionId = getSessionId();
  if (!sessionId) {
    throw new ServiceError('Session expired. Please login again.');
  }

  const response = await fetch('/api/tr-report/view', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': sessionId,
    },
    body: JSON.stringify({ requestUserId: normalizedRequestUserId }),
  });

  let payload: TravelReportViewResponse = {};
  try {
    payload = (await response.json()) as TravelReportViewResponse;
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new ServiceError(String(payload.message ?? '').trim() || `Failed to load report data (${response.status})`);
  }

  return Array.isArray(payload.rows) ? payload.rows : [];
}
