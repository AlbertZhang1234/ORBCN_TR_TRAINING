import { selectRows } from '../_core/supabaseRest';
import { TABLES } from '../_core/tables';

export interface ProjectListRow extends Record<string, unknown> {
  projectid: string;
  description?: string;
  customerid?: string;
  paymentterm?: string;
  projectmanager?: string;
  salesperson?: string;
  trchargeable?: boolean;
  txchargeable?: boolean;
}

export async function listProjects(): Promise<ProjectListRow[]> {
  return selectRows<ProjectListRow>(TABLES.project, {
    orderBy: { column: 'projectid', ascending: true },
  });
}
