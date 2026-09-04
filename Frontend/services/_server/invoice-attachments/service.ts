import { randomUUID } from 'node:crypto';
import { ServiceError } from '../../_core/error';
import type { RequestAuthContext } from '../requestAuth';
import { InvoiceAttachmentFiles } from './files';
import { InvoiceAttachmentRepository, type AttachmentRow, type InvoiceFileAccessRow } from './repository';
import { isBookedStatus, isSubmittedStatus } from '../../_core/locks';

const same = (left: unknown, right: unknown) => String(left ?? '').trim().toLowerCase() === String(right ?? '').trim().toLowerCase();

export class InvoiceAttachmentService {
  constructor(private readonly repo: InvoiceAttachmentRepository, private readonly files: InvoiceAttachmentFiles,
    private readonly maxBytes: number) {}

  private assertAccess(auth: RequestAuthContext, invoice: InvoiceFileAccessRow | undefined, write = false) {
    if (!invoice) throw new ServiceError('发票或原始文件不存在', { status: 404 });
    if (auth.permissions.isAdmin || auth.permissions.isFinance || same(invoice.userid, auth.userid)) return;
    if (!write && auth.permissions.isProjectManager && same(invoice.projectmanager, auth.userid)) return;
    throw new ServiceError('无权访问该发票原始文件', { status: 403 });
  }

  async save(auth: RequestAuthContext, invoiceNo: string, file: File) {
    const normalized = invoiceNo.trim();
    if (!normalized || !file.size || file.size > this.maxBytes)
      throw new ServiceError(`文件必须非空且不超过 ${this.maxBytes / 1024 / 1024} MB`, { status: 400 });
    const id = randomUUID();
    const stored = await this.files.store(id, Buffer.from(await file.arrayBuffer()));
    let old: AttachmentRow | undefined;
    try {
      const row = await this.repo.transaction(async (db) => {
        const invoice = await this.repo.access(db, normalized, true);
        this.assertAccess(auth, invoice, true);
        if (isSubmittedStatus(invoice!.status) || isBookedStatus(invoice!.status))
          throw new ServiceError('已提交或已记账的发票不能修改附件', { status: 409 });
        old = await this.repo.byInvoice(db, normalized);
        return this.repo.replace(db, { id, invoiceno: normalized, ...stored,
          original_filename: file.name.slice(0, 255) || `invoice.${stored.storage_key.split('.').pop()}`,
          file_size: file.size });
      });
      if (old && old.storage_key !== row.storage_key) await this.files.remove(old.storage_kind, old.storage_key).catch(() => undefined);
      return row;
    } catch (error) {
      await this.files.remove(stored.storage_kind, stored.storage_key).catch(() => undefined);
      throw error;
    }
  }

  async read(auth: RequestAuthContext, invoiceNo: string) {
    const result = await this.repo.transaction(async (db) => {
      const invoice = await this.repo.access(db, invoiceNo);
      this.assertAccess(auth, invoice);
      return { invoice: invoice!, attachment: await this.repo.byInvoice(db, invoiceNo) };
    });
    return this.readResolved(invoiceNo, result.attachment);
  }

  async readMany(invoiceNos: string[]) {
    const results: Array<{ filename: string; bytes: Buffer }> = [];
    const missing: string[] = [];
    for (const invoiceNo of invoiceNos) {
      try {
        const attachment = await this.repo.transaction(async (db) => {
          if (!(await this.repo.access(db, invoiceNo))) return undefined;
          return this.repo.byInvoice(db, invoiceNo);
        });
        const source = await this.readResolved(invoiceNo, attachment);
        results.push({ filename: source.filename, bytes: source.bytes });
      } catch { missing.push(invoiceNo); }
    }
    return { files: results, missing };
  }

  async deleteInvoice(auth: RequestAuthContext, invoiceNo: string) {
    let attachment: AttachmentRow | undefined;
    const deleted = await this.repo.transaction(async (db) => {
      const invoice = await this.repo.access(db, invoiceNo, true);
      if (!invoice) return false;
      this.assertAccess(auth, invoice, true);
      if (isSubmittedStatus(invoice.status) || isBookedStatus(invoice.status))
        throw new ServiceError('已提交或已记账的发票不能删除', { status: 409 });
      attachment = await this.repo.byInvoice(db, invoiceNo);
      return Boolean((await db.query('DELETE FROM otto_invoices WHERE invoiceno=$1', [invoiceNo])).rowCount);
    });
    if (deleted && attachment) await this.files.remove(attachment.storage_kind, attachment.storage_key).catch(() => undefined);
    return deleted;
  }

  private async readResolved(invoiceNo: string, row?: AttachmentRow) {
    if (row) {
      try { return { bytes: await this.files.read(row.storage_kind, row.storage_key),
        content_type: row.content_type, filename: row.original_filename }; }
      catch { throw new ServiceError('原始文件不存在，请检查服务器存储', { status: 404 }); }
    }
    const legacy = await this.files.findLegacyInvoice(invoiceNo);
    if (!legacy) throw new ServiceError('原始文件不存在', { status: 404 });
    await this.repo.transaction(async (db) => {
      await this.repo.replace(db, { id: randomUUID(), invoiceno: invoiceNo,
        storage_kind: legacy.storage_kind, storage_key: legacy.storage_key,
        original_filename: legacy.filename, content_type: legacy.content_type, file_size: legacy.file_size });
    }).catch(() => undefined);
    return { bytes: legacy.bytes, content_type: legacy.content_type, filename: legacy.filename };
  }
}
