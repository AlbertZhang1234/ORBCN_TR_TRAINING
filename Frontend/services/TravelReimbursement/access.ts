import type { RequestAuthContext } from '@/services/_server/requestAuth';

interface ReimbursementHeaderAccessRow extends Record<string, unknown> {
  userid?: string;
  approver?: string;
  approvalby?: string;
  approvedby?: string;
}

export function sameUser(a: unknown, b: string): boolean {
  return String(a ?? '').trim().toLowerCase() === b.trim().toLowerCase();
}

export function readRowString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = String(row[key] ?? '').trim();
    if (value) {
      return value;
    }
  }
  return '';
}

export function canAccessReimbursementHeader(
  auth: RequestAuthContext,
  header: ReimbursementHeaderAccessRow,
  projectManager?: string,
): boolean {
  if (auth.permissions.isAdmin || auth.permissions.isFinance) {
    return true;
  }

  if (sameUser(header.userid, auth.userid)) {
    return true;
  }

  if (
    sameUser(header.approver, auth.userid) ||
    sameUser(header.approvalby, auth.userid) ||
    sameUser(header.approvedby, auth.userid)
  ) {
    return true;
  }

  if (projectManager && sameUser(projectManager, auth.userid)) {
    return true;
  }

  return false;
}

export function canActAsApprover(
  auth: RequestAuthContext,
  approver: string,
): boolean {
  if (auth.permissions.isAdmin || auth.permissions.isFinance) {
    return true;
  }

  return sameUser(auth.userid, approver);
}
