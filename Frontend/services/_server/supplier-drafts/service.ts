import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { ServiceError } from '../../_core/error';
import type { RequestAuthContext } from '../requestAuth';
import { emptyHeader, lineForSave, validateDraft, type EditableHeader, type EditableLine } from '../../Invoice/supplier-draft-model';
import { createSupplierInvoiceWithLines } from '../supplierInvoiceRecognition';
import { SupplierDraftRepository, draftView, type DraftRow } from './repository';
import { SupplierDraftFiles } from './files';
import { InvoiceAttachmentRepository } from '../invoice-attachments/repository';
import { draftContent, requireDraftId } from './validation';

export class SupplierDraftService {
  constructor(private readonly repo: SupplierDraftRepository, private readonly files: SupplierDraftFiles,
    private readonly maxBytes: number, private readonly attachments: InvoiceAttachmentRepository) {}

  async list(auth: RequestAuthContext) { return (await this.repo.list(auth.userid)).map(draftView); }

  async upload(auth: RequestAuthContext, file: File, businessType: string) {
    if (!['01','02'].includes(businessType)) throw new ServiceError('业务类型只能是 01 或 02', { status: 400 });
    if (!file.size || file.size > this.maxBytes) throw new ServiceError(`文件必须非空且不超过 ${this.maxBytes / 1024 / 1024} MB`, { status: 400 });
    const id = randomUUID();
    const stored = await this.files.store(id, Buffer.from(await file.arrayBuffer()));
    try {
      return await this.repo.transaction(async (db) => draftView((await db.query<DraftRow>(
        `INSERT INTO otto_supplier_invoice_drafts(id,userid,filename,storage_key,storage_kind,content_type,file_size,header)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING *`,
        [id,auth.userid,file.name.slice(0,255),stored.storage_key,stored.storage_kind,stored.content_type,file.size,
          JSON.stringify(emptyHeader(businessType as '01'|'02'))],
      )).rows[0]));
    } catch (error) {
      await this.files.remove(stored.storage_kind, stored.storage_key).catch(() => undefined);
      throw error;
    }
  }

  private async locked(db: pg.PoolClient, auth: RequestAuthContext, id: string, version?: number) {
    requireDraftId(id);
    const row = (await db.query<DraftRow>('SELECT * FROM otto_supplier_invoice_drafts WHERE id=$1 AND userid=$2 FOR UPDATE', [id,auth.userid])).rows[0];
    if (!row) throw new ServiceError('草稿不存在或无权访问', { status: 404 });
    if (version !== undefined && row.version !== version) throw new ServiceError('草稿已在其他页面更新，请刷新后重试', { status: 409 });
    return row;
  }

  async patch(auth: RequestAuthContext, id: string, input: { version: number; header: EditableHeader; lines: EditableLine[] }) {
    const content = draftContent(input);
    if (!Number.isInteger(input.version)) throw new ServiceError('Missing draft version', { status: 400 });
    return this.repo.transaction(async (db) => {
      const row = await this.locked(db, auth, id, input.version);
      this.editable(row);
      return draftView((await db.query<DraftRow>(
        `UPDATE otto_supplier_invoice_drafts SET header=$2::jsonb, lines=$3::jsonb,
         status='editing', version=version+1, updated_at=now(), error=NULL WHERE id=$1 RETURNING *`,
        [id,JSON.stringify(content.header),JSON.stringify(content.lines)],
      )).rows[0]);
    });
  }

  private editable(row: DraftRow) {
    if (['saved','queued','recognizing'].includes(row.status))
      throw new ServiceError('当前状态不能修改草稿', { status: 409 });
  }

  async action(auth: RequestAuthContext, id: string, action: string, version: number) {
    if (!['retry','save'].includes(action) || !Number.isInteger(version))
      throw new ServiceError('Invalid action or version', { status: 400 });
    return this.repo.transaction(async (db) => {
      const row = await this.locked(db, auth, id);
      if (action === 'save' && row.status === 'saved') return draftView(row); // response-loss retry
      if (row.version !== version) throw new ServiceError('草稿已更新，请刷新后重试', { status: 409 });
      this.editable(row);
      if (action !== 'retry') {
        const errors = validateDraft(row);
        if (errors.length) throw new ServiceError(errors.join('；'), { status: 400 });
      }
      if (action === 'save') {
        await this.files.read(row.storage_kind, row.storage_key); // Do not create an invoice with a missing attachment.
        await createSupplierInvoiceWithLines({ withTransaction: (work) => work(db) }, auth, row.header, row.lines.map(lineForSave));
        await this.attachments.replace(db, { id: row.id, invoiceno: row.header.invoiceno.trim(),
          storage_kind: row.storage_kind, storage_key: row.storage_key, original_filename: row.filename,
          content_type: row.content_type, file_size: row.file_size });
      }
      return draftView((await db.query<DraftRow>(
        `UPDATE otto_supplier_invoice_drafts SET status=$2, error=NULL, lease_token=NULL, lease_until=NULL,
         saved_invoice_no=$3, version=version+1, updated_at=now() WHERE id=$1 RETURNING *`,
        [id, action === 'save' ? 'saved' : 'queued',
          action === 'save' ? row.header.invoiceno.trim() : null],
      )).rows[0]);
    });
  }
}
