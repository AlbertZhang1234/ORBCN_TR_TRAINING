import type pg from 'pg';
import type { SupplierInvoiceDraft } from '../../Invoice/supplier-draft-model';

export type Transaction = <T>(work: (client: pg.PoolClient) => Promise<T>) => Promise<T>;
export interface DraftRow extends SupplierInvoiceDraft {
  userid: string;
  storage_key: string;
  content_type: string;
  file_size: number;
  lease_token?: string;
}
export const draftView = (row: DraftRow): SupplierInvoiceDraft => ({
  id: row.id, filename: row.filename, status: row.status, header: row.header,
  lines: row.lines, version: row.version, error: row.error, saved_invoice_no: row.saved_invoice_no,
});

export class SupplierDraftRepository {
  constructor(readonly transaction: Transaction) {}
  list(userid: string) {
    return this.transaction(async (db) => (await db.query<DraftRow>(
      `SELECT * FROM otto_supplier_invoice_drafts WHERE userid=$1
       AND status <> 'saved' ORDER BY created_at DESC`, [userid],
    )).rows);
  }
  async claim(token: string): Promise<DraftRow | undefined> {
    return this.transaction(async (db) => (await db.query<DraftRow>(
      `UPDATE otto_supplier_invoice_drafts SET status='recognizing', lease_token=$1,
         lease_until=now()+interval '5 minutes', updated_at=now(), version=version+1
       WHERE id=(SELECT id FROM otto_supplier_invoice_drafts
         WHERE status='queued' OR (status='recognizing' AND lease_until < now())
         ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`, [token],
    )).rows[0]);
  }
  async finish(id: string, token: string, content: unknown, result: unknown, error: string | null) {
    return this.transaction(async (db) => {
      await db.query(
        `UPDATE otto_supplier_invoice_drafts SET status=$3, error=$4,
           header=COALESCE($5::jsonb->'header',header), lines=COALESCE($5::jsonb->'lines',lines),
           recognized_result=$6::jsonb, version=version+1, lease_token=NULL, lease_until=NULL, updated_at=now()
         WHERE id=$1 AND lease_token=$2 AND status='recognizing'`,
        [id, token, error ? 'error' : 'ready', error, content ? JSON.stringify(content) : null, JSON.stringify(result)],
      );
    });
  }
}
