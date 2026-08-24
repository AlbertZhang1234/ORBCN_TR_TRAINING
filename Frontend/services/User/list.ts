import { selectRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export interface UserListRow extends Record<string, unknown> {
  userid: string;
  email?: string;
  firstname?: string;
  lastname?: string;
  mobile?: string;
}

export interface UserRoleRow extends Record<string, unknown> {
  userid: string;
  roleid: string;
}

export async function listUsers(): Promise<UserListRow[]> {
  return selectRows<UserListRow>(TABLES.user, {
    orderBy: { column: 'userid', ascending: true },
  });
}

export async function listUserRoles(): Promise<UserRoleRow[]> {
  return selectRows<UserRoleRow>(TABLES.userRole, {
    orderBy: { column: 'userid', ascending: true },
  });
}
