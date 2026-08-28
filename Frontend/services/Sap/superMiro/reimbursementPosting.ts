import { ServiceError } from '../../_core/error';
import { normalizeWorkflowStatus } from '../../_core/locks';
import type {
  SuperMiroReimbursementPostingDependencies,
  SuperMiroReimbursementPostingItemResult,
  SuperMiroReimbursementPostingResult,
  SuperMiroReimbursementReference,
} from './reimbursementTypes';
import { buildType03SuperMiroPayloads } from './type03Payload';

function referenceKey(reference: SuperMiroReimbursementReference): string {
  return String(reference.id ?? reference.trno ?? '').trim();
}

function normalizeReferences(
  references: SuperMiroReimbursementReference[],
): SuperMiroReimbursementReference[] {
  const unique = new Map<string, SuperMiroReimbursementReference>();
  for (const reference of references) {
    const key = referenceKey(reference);
    if (key) {
      unique.set(key, reference);
    }
  }
  if (unique.size === 0) {
    throw new ServiceError('At least one reimbursement is required', { status: 400 });
  }
  return Array.from(unique.values());
}

export async function postType03ReimbursementsToSuperMiro(
  references: SuperMiroReimbursementReference[],
  dependencies: SuperMiroReimbursementPostingDependencies,
): Promise<SuperMiroReimbursementPostingResult> {
  const normalizedReferences = normalizeReferences(references);
  const items: SuperMiroReimbursementPostingItemResult[] = [];

  for (const reference of normalizedReferences) {
    let reimbursementId = referenceKey(reference);
    let reimbursementNo = reimbursementId;
    let totalLines = 0;
    let postedLines = 0;

    try {
      const source = await dependencies.loadReimbursement(reference);
      reimbursementId = String(source.id);
      reimbursementNo = String(source.trno ?? '').trim() || reimbursementId;
      if (normalizeWorkflowStatus(source.approvalStatus) !== 'APPROVED') {
        throw new ServiceError(`Reimbursement ${reimbursementNo} must be approved before SAP posting`, {
          status: 409,
        });
      }

      const payloads = buildType03SuperMiroPayloads(source);
      totalLines = payloads.length;
      for (const payload of payloads) {
        await dependencies.postPayload(payload);
        postedLines += 1;
      }

      await dependencies.markReimbursementSapPosted(source);

      items.push({
        reimbursementId,
        reimbursementNo,
        success: true,
        totalLines,
        postedLines,
      });
    } catch (error) {
      items.push({
        reimbursementId,
        reimbursementNo,
        success: false,
        totalLines,
        postedLines,
        message: error instanceof Error ? error.message : 'SAP posting failed',
      });
    }
  }

  const successfulReimbursements = items.filter((item) => item.success).length;
  const failedReimbursements = items.length - successfulReimbursements;
  return {
    success: failedReimbursements === 0,
    totalReimbursements: items.length,
    successfulReimbursements,
    failedReimbursements,
    items,
  };
}
