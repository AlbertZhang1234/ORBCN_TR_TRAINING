import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { ServiceError } from '../../_core/error';
import { isBookedStatus, isSubmittedStatus } from '../../_core/locks';
import { validateDraft } from '../../Invoice/supplier-draft-model';
import type { SupplierInvoiceDetail } from '../../Invoice/supplier-edit-model';
import type { RequestAuthContext } from '../requestAuth';
import type { Transaction } from '../supplier-drafts/repository';
import { SupplierDraftFiles } from '../supplier-drafts/files';
import { draftContent } from '../supplier-drafts/validation';
import { normalizeSupplierInvoiceHeader } from '../supplierInvoiceRecognition';
import { readSupplierInvoice, writeSupplierInvoice } from './repository';

const fail = (message: string, status = 400): never => { throw new ServiceError(message, { status }); };
const privileged = (auth: RequestAuthContext) => auth.permissions.isAdmin || auth.permissions.isFinance;

function normalizeDetail(input: SupplierInvoiceDetail): SupplierInvoiceDetail {
  const content = draftContent(input);
  const errors = validateDraft(content);
  if (errors.length) fail(errors.join('；'));
  const normalized = normalizeSupplierInvoiceHeader(content.header);
  const originalamount = input.header.originalamount;
  if (originalamount !== null && (typeof originalamount !== 'number' || !Number.isFinite(originalamount))) fail('原币金额必须是有效数字');
  if (!input.header.userid?.trim()) fail('用户 ID 不能为空');
  if (typeof input.revision !== 'string' || !input.revision) fail('缺少发票版本，请重新打开修改窗口');
  return { ...content, revision: input.revision, header: {
    ...content.header, ...normalized, businesstype: content.header.businesstype, invoicedate: normalized.invoicedate ?? '',
    userid: input.header.userid.trim(), travelid: String(input.header.travelid ?? '').trim(),
    originalamount, originalcurrency: String(input.header.originalcurrency ?? '').trim().toUpperCase(),
    status: String(input.header.status ?? ''),
  } };
}

function assertAccess(auth: RequestAuthContext, detail: SupplierInvoiceDetail | null): asserts detail is SupplierInvoiceDetail {
  if (!detail || !['01', '02'].includes(detail.header.businesstype)) fail('供应商发票不存在', 404);
  if (!privileged(auth) && detail.header.userid.toLowerCase() !== auth.userid.toLowerCase()) fail('无权访问其他用户的发票', 403);
}

export class SupplierInvoiceEditService {
  constructor(private readonly transaction: Transaction, private readonly files: SupplierDraftFiles) {}

  async load(auth: RequestAuthContext, invoiceNo: string) {
    if (!invoiceNo.trim()) fail('发票号码不能为空');
    return this.transaction(async (db) => {
      const detail = await readSupplierInvoice(db, invoiceNo, 'read');
      assertAccess(auth, detail);
      return detail;
    });
  }

  async save(auth: RequestAuthContext, invoiceNo: string, input: SupplierInvoiceDetail) {
    const detail = normalizeDetail(input);
    let createdFile: string | undefined;
    try {
      return await this.transaction(async (db) => {
        const current = await readSupplierInvoice(db, invoiceNo, 'write');
        assertAccess(auth, current);
        if (isSubmittedStatus(current.header.status) || isBookedStatus(current.header.status)) fail('已提交或已记账的发票不能修改', 409);
        if (current.revision !== detail.revision) fail('发票已被其他页面修改，请重新打开后重试', 409);
        if (detail.header.status !== current.header.status) fail('请通过提交或记账操作修改流程状态');
        if (!privileged(auth) && detail.header.userid !== current.header.userid) fail('无权更改发票所属用户', 403);
        await this.checkReferences(db, detail, current);
        if (invoiceNo !== detail.header.invoiceno) createdFile = await this.preserveLegacySource(db, current);
        return writeSupplierInvoice(db, invoiceNo, detail);
      });
    } catch (error) {
      if (createdFile) await this.files.remove(createdFile).catch(() => undefined);
      if ((error as { code?: string })?.code === '23505') fail('发票号码已存在，请检查后重试', 409);
      if (['22007', '22008'].includes((error as { code?: string })?.code ?? '')) fail('发票日期无效');
      throw error;
    }
  }

  private async checkReferences(db: pg.PoolClient, detail: SupplierInvoiceDetail, current: SupplierInvoiceDetail) {
    const h = detail.header;
    if (h.userid !== current.header.userid && !(await db.query('SELECT userid FROM otto_user WHERE userid=$1', [h.userid])).rowCount)
      fail('用户不存在，请检查用户 ID');
    if (h.travelid && h.travelid !== current.header.travelid && !(await db.query('SELECT travelid FROM otto_travelentry WHERE travelid=$1', [h.travelid])).rowCount)
      fail('差旅记录不存在，请检查差旅 ID');
  }

  private async preserveLegacySource(db: pg.PoolClient, current: SupplierInvoiceDetail) {
    const invoiceNo = current.header.invoiceno;
    if ((await db.query('SELECT id FROM otto_supplier_invoice_drafts WHERE saved_invoice_no=$1', [invoiceNo])).rowCount) return;
    const source = await this.files.readLegacy(invoiceNo).catch((error) => {
      if (error instanceof ServiceError && error.status === 404) return null;
      throw error;
    });
    if (!source) return;
    const id = randomUUID();
    const stored = await this.files.store(id, source.bytes);
    try {
      await db.query(`INSERT INTO otto_supplier_invoice_drafts
        (id,userid,filename,storage_key,content_type,file_size,status,header,lines,saved_invoice_no)
        VALUES($1,$2,$3,$4,$5,$6,'saved',$7::jsonb,$8::jsonb,$9)`, [id, current.header.userid,
        source.filename, stored.storage_key, stored.content_type, source.bytes.length,
        JSON.stringify(current.header), JSON.stringify(current.lines), invoiceNo]);
      return stored.storage_key;
    } catch (error) { await this.files.remove(stored.storage_key).catch(() => undefined); throw error; }
  }
}
