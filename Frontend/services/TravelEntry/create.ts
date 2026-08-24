import { ServiceError } from '../_core/error';
import { readStringCandidate, requireProject, requireUser } from '../_core/dependencies';
import { insertRows, updateRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export interface TravelEntryRecord extends Record<string, unknown> {
  travelid: string;
  userid: string;
  projectid?: string;
}

function buildProjectKeyCandidates(
  payload: TravelEntryRecord,
  resolvedProjectRow: Record<string, unknown>,
  selectedProjectId: string,
): TravelEntryRecord[] {
  const candidates: TravelEntryRecord[] = [{ ...payload, projectid: selectedProjectId }];
  const fallback = readStringCandidate(resolvedProjectRow, ['project', 'project_id', 'projectid']);

  if (fallback && fallback !== selectedProjectId) {
    candidates.push({ ...payload, projectid: fallback });
  }

  return candidates;
}

async function trySyncLegacyProjectKey(projectId: string): Promise<void> {
  // Some legacy schemas use otto_project.project as FK target while UI uses projectid.
  try {
    await updateRows(TABLES.project, { projectid: projectId }, { project: projectId });
  } catch {
    // ignore if "project" column doesn't exist or update is not allowed
  }
}

export async function createTravelEntry(
  payload: TravelEntryRecord,
): Promise<TravelEntryRecord> {
  if (!payload.travelid?.trim()) {
    throw new ServiceError('travelid is required');
  }

  if (!payload.userid?.trim()) {
    throw new ServiceError('userid is required');
  }

  if (!payload.projectid?.trim()) {
    throw new ServiceError('projectid is required. Create project first.');
  }

  const normalizedUserId = payload.userid.trim();
  const normalizedProjectId = payload.projectid.trim();

  await requireUser(normalizedUserId);
  const projectRow = await requireProject(normalizedProjectId);
  await trySyncLegacyProjectKey(normalizedProjectId);

  const candidates = buildProjectKeyCandidates(
    {
      ...payload,
      userid: normalizedUserId,
      projectid: normalizedProjectId,
    },
    projectRow,
    normalizedProjectId,
  );
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const rows = await insertRows<TravelEntryRecord>(TABLES.travelEntry, candidate);
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

  throw new ServiceError('createTravelEntry failed: no row returned');
}
