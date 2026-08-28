import type {
  SuperMiroReimbursementPostingResult,
  SuperMiroReimbursementReference,
} from '../Sap/superMiro';
import { ServiceError } from '../_core/error';
import { getClientSessionId } from '../_core/session';

interface ErrorResponse {
  message?: string;
}

export async function postReimbursementsToSap(
  reimbursements: SuperMiroReimbursementReference[],
  language: 'zh' | 'en' = 'zh',
): Promise<SuperMiroReimbursementPostingResult> {
  const response = await fetch('/api/sap/super-miro/reimbursements', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': getClientSessionId(),
    },
    body: JSON.stringify({ reimbursements, language }),
  });

  const payload = (await response.json().catch(() => ({}))) as
    | SuperMiroReimbursementPostingResult
    | ErrorResponse;
  if (!response.ok) {
    throw new ServiceError(
      String((payload as ErrorResponse).message ?? '').trim() ||
        `SAP reimbursement posting failed (${response.status})`,
      { status: response.status },
    );
  }
  return payload as SuperMiroReimbursementPostingResult;
}
