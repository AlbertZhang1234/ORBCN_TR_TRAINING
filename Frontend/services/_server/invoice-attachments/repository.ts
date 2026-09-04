import type pg from 'pg';
import type { Transaction } from '../supplier-drafts/repository';
import type { StorageKind } from './files';

export interface AttachmentRow extends pg.QueryResultRow {
  id: string;
  invoiceno: string;
  storage_kind: StorageKind;
  storage_key: string;
  original_filename: string;
  content_type: string;
  file_size: number;
}

export interface InvoiceFileAccessRow extends pg.QueryResultRow {
  invoiceno: string;
  userid?: string;
  projectmanager?: string;
  status?: string;
}

export class InvoiceAttachmentRepository {
  constructor(readonly transaction: Transaction) {}

  async access(db: pg.PoolClient, invoiceNo: string, lock = false) {
    return (await db.query<InvoiceFileAccessRow>(`SELECT i.invoiceno,i.userid,i.status,p.projectmanager
      FROM otto_invoices i LEFT JOIN otto_travelentry te ON te.travelid=i.travelid
      LEFT JOIN otto_project p ON p.projectid=te.projectid WHERE i.invoiceno=$1
      ${lock ? 'FOR UPDATE OF i' : ''}`, [invoiceNo])).rows[0];
  }

  async byInvoice(db: pg.PoolClient, invoiceNo: string) {
    return (await db.query<AttachmentRow>('SELECT * FROM otto_invoice_attachments WHERE invoiceno=$1', [invoiceNo])).rows[0];
  }

  async replace(db: pg.PoolClient, row: AttachmentRow) {
    return (await db.query<AttachmentRow>(`INSERT INTO otto_invoice_attachments
      (id,invoiceno,storage_kind,storage_key,original_filename,content_type,file_size)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(invoiceno) DO UPDATE SET
      storage_kind=EXCLUDED.storage_kind,storage_key=EXCLUDED.storage_key,
      original_filename=EXCLUDED.original_filename,content_type=EXCLUDED.content_type,
      file_size=EXCLUDED.file_size,updated_at=now() RETURNING *`,
    [row.id,row.invoiceno,row.storage_kind,row.storage_key,row.original_filename,row.content_type,row.file_size])).rows[0];
  }
}
