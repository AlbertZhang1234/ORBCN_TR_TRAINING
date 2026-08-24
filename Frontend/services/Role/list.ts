import { selectRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export interface RoleRecord extends Record<string, unknown> {
  roleid: string;
  description?: string;
}

export async function listRoles(): Promise<RoleRecord[]> {
  return selectRows<RoleRecord>(TABLES.role, {
    orderBy: { column: 'roleid', ascending: true },
  });
}
