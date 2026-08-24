import { ServiceError } from '../_core/error';
import { deleteRows, selectRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export async function deleteProject(projectId: string): Promise<boolean> {
  if (!projectId?.trim()) {
    throw new ServiceError('projectId is required');
  }

  const relatedTravelEntries = await selectRows(TABLES.travelEntry, {
    select: 'travelid',
    filters: { projectid: projectId },
    limit: 1,
  }).catch(() => []);

  const relatedTravelEntriesByProject = await selectRows(TABLES.travelEntry, {
    select: 'travelid',
    filters: { project: projectId },
    limit: 1,
  }).catch(() => []);

  if (relatedTravelEntries.length > 0 || relatedTravelEntriesByProject.length > 0) {
    throw new ServiceError(
      `Project ${projectId} has related travel entries and cannot be deleted`,
    );
  }

  const deleted = await deleteRows(TABLES.project, { projectid: projectId });
  return deleted.length > 0;
}
