export interface PermissionFlags {
  isAdmin: boolean;
  isFinance: boolean;
  isProjectManager: boolean;
}

function normalizeRoleId(roleId: string): string {
  return roleId.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function isAdminRole(roleId: string): boolean {
  const normalized = normalizeRoleId(roleId);
  return (
    normalized.includes('admin') ||
    normalized.includes('superadmin') ||
    normalized.includes('systemadmin') ||
    normalized.includes('管理员')
  );
}

function isFinanceRole(roleId: string): boolean {
  const normalized = normalizeRoleId(roleId);
  return (
    normalized.includes('finance') ||
    normalized.includes('accounting') ||
    normalized.includes('bookkeeper') ||
    normalized.includes('财务')
  );
}

function isProjectManagerRole(roleId: string): boolean {
  const raw = roleId.trim().toLowerCase();
  const normalized = normalizeRoleId(roleId);
  if (normalized === 'pm') {
    return true;
  }
  return (
    normalized.includes('projectmanager') ||
    normalized.includes('项目经理') ||
    (normalized.includes('manager') && raw.includes('project'))
  );
}

export function derivePermissionFlags(roleIds: string[]): PermissionFlags {
  const ids = roleIds.map((x) => String(x ?? '').trim()).filter((x) => x.length > 0);

  return {
    isAdmin: ids.some(isAdminRole),
    isFinance: ids.some(isFinanceRole),
    isProjectManager: ids.some(isProjectManagerRole),
  };
}

