import { ServiceError } from '../_core/error';
import { updateRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

function buildPatchCandidates(
  patch: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const candidates: Array<Record<string, unknown>> = [{ ...patch }];

  if (Object.prototype.hasOwnProperty.call(patch, 'customerid')) {
    const alt = { ...patch };
    alt.customer = patch.customerid;
    delete alt.customerid;
    candidates.push(alt);
  } else if (Object.prototype.hasOwnProperty.call(patch, 'customer')) {
    const alt = { ...patch };
    alt.customerid = patch.customer;
    delete alt.customer;
    candidates.push(alt);
  }

  return candidates;
}

export async function changeProject(
  projectId: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!projectId?.trim()) {
    throw new ServiceError('projectId is required');
  }

  if (!patch || Object.keys(patch).length === 0) {
    throw new ServiceError('patch is empty');
  }

  const candidates = buildPatchCandidates(patch);
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const rows = await updateRows(TABLES.project, { projectid: projectId }, candidate);
      if (rows[0]) {
        return rows[0];
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new ServiceError(`changeProject failed: project ${projectId} not found`);
}
