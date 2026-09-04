import { ServiceError } from '../../_core/error';
import type { RequestAuthContext } from '../requestAuth';
import { SupplierDraftRepository, type DraftRow } from './repository';
import { SupplierDraftFiles } from './files';
import { InvoiceAttachmentService } from '../invoice-attachments/service';
import { requireDraftId } from './validation';

export class SupplierSourceService {
  constructor(private readonly repo: SupplierDraftRepository, private readonly files: SupplierDraftFiles,
    private readonly attachments: InvoiceAttachmentService) {}
  async read(auth: RequestAuthContext, draftId: string | null, invoiceNo: string | null) {
    if (Boolean(draftId) === Boolean(invoiceNo)) throw new ServiceError('Specify draftId or invoiceNo', { status: 400 });
    if (invoiceNo) return this.attachments.read(auth, invoiceNo);
    const row = await this.repo.transaction(async (db) => {
      requireDraftId(draftId!);
      const draft = (await db.query<DraftRow>('SELECT * FROM otto_supplier_invoice_drafts WHERE id=$1 AND userid=$2', [draftId,auth.userid])).rows[0];
      if (!draft) throw new ServiceError('原文件不存在或无权访问', { status: 404 });
      return draft;
    });
    try { return { bytes: await this.files.read(row.storage_kind, row.storage_key), content_type: row.content_type, filename: row.filename }; }
    catch { throw new ServiceError('原始文件不存在，请检查服务器存储', { status: 404 }); }
  }
}
