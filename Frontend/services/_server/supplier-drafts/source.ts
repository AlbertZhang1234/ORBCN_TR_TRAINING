import { ServiceError } from '../../_core/error';
import type { RequestAuthContext } from '../requestAuth';
import { SupplierDraftRepository, type DraftRow } from './repository';
import { SupplierDraftFiles } from './files';
import { requireDraftId } from './validation';

export class SupplierSourceService {
  constructor(private readonly repo: SupplierDraftRepository, private readonly files: SupplierDraftFiles) {}
  async read(auth: RequestAuthContext, draftId: string | null, invoiceNo: string | null) {
    if (Boolean(draftId) === Boolean(invoiceNo)) throw new ServiceError('Specify draftId or invoiceNo', { status: 400 });
    const row = await this.repo.transaction(async (db) => {
      if (draftId) {
        requireDraftId(draftId);
        const draft = (await db.query<DraftRow>('SELECT * FROM otto_supplier_invoice_drafts WHERE id=$1 AND userid=$2', [draftId,auth.userid])).rows[0];
        if (!draft) throw new ServiceError('原文件不存在或无权访问', { status: 404 });
        return draft;
      }
      const invoice = (await db.query('SELECT userid FROM otto_invoices WHERE invoiceno=$1 AND businesstype IN (\'01\',\'02\')', [invoiceNo])).rows[0];
      if (!invoice || (!auth.permissions.isAdmin && !auth.permissions.isFinance && invoice.userid !== auth.userid))
        throw new ServiceError('原文件不存在或无权访问', { status: 404 });
      return (await db.query<DraftRow>('SELECT * FROM otto_supplier_invoice_drafts WHERE saved_invoice_no=$1 AND status=\'saved\'', [invoiceNo])).rows[0];
    });
    if (!row) return this.files.readLegacy(invoiceNo!);
    try { return { bytes: await this.files.read(row.storage_key), content_type: row.content_type, filename: row.filename }; }
    catch { throw new ServiceError('原始文件不存在，请检查服务器存储', { status: 404 }); }
  }
}
