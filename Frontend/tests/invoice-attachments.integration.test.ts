import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import pg from 'pg';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { InvoiceAttachmentFiles } from '../services/_server/invoice-attachments/files';
import { InvoiceAttachmentRepository } from '../services/_server/invoice-attachments/repository';
import { InvoiceAttachmentService } from '../services/_server/invoice-attachments/service';
import type { RequestAuthContext } from '../services/_server/requestAuth';

const auth: RequestAuthContext = { userid: 'owner', sessionId: 'test', roleids: [],
  permissions: { isAdmin: false, isFinance: false, isProjectManager: false } };
const other = { ...auth, userid: 'other' };
const finance = { ...other, permissions: { ...auth.permissions, isFinance: true } };

test('one attachment service stores, authorizes, replaces and reads legacy files for all invoice flows',
  { skip: !process.env.INVOICE_ATTACHMENT_INTEGRATION }, async () => {
    const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    const root = await mkdtemp(path.join(tmpdir(), 'invoice-attachment-test-'));
    const managed = path.join(root, 'managed');
    const legacy = path.join(root, 'legacy');
    const supplierLegacy = path.join(root, 'supplier');
    const schema = `attachment_test_${randomUUID().replaceAll('-', '')}`;
    let savepoint = 0;
    try {
      await db.query('BEGIN');
      await db.query(`CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}",public`);
      await db.query(`CREATE TABLE otto_invoices (LIKE public.otto_invoices INCLUDING ALL);
        CREATE TABLE otto_invoice_lines (LIKE public.otto_invoice_lines INCLUDING ALL);
        CREATE TABLE otto_travelentry(travelid text PRIMARY KEY, projectid text);
        CREATE TABLE otto_project(projectid text PRIMARY KEY, projectmanager text);`);
      await db.query(await readFile('../Backend/Database/migration/create_supplier_invoice_drafts.sql', 'utf8'));
      await db.query(await readFile('../Backend/Database/migration/create_invoice_attachments.sql', 'utf8'));
      const transaction = async <T>(work: (client: pg.PoolClient) => Promise<T>) => {
        const point = `sp${++savepoint}`;
        await db.query(`SAVEPOINT ${point}`);
        try { const result = await work(db as unknown as pg.PoolClient); await db.query(`RELEASE SAVEPOINT ${point}`); return result; }
        catch (error) { await db.query(`ROLLBACK TO SAVEPOINT ${point}`); throw error; }
      };
      const files = new InvoiceAttachmentFiles(managed, legacy, supplierLegacy);
      const repo = new InvoiceAttachmentRepository(transaction);
      const service = new InvoiceAttachmentService(repo, files, 1024 * 1024);
      await db.query("INSERT INTO otto_invoices(invoiceno,userid,businesstype,status) VALUES('NORMAL','owner','03','OPEN'),('LEGACY','owner','03','OPEN'),('DELETE-ME','owner','03','OPEN'),('SUP-OLD','owner','01','OPEN'),('LOCKED','owner','03','SUBMITTED')");

      const first = new File(['%PDF-1.4\nfirst'], 'receipt-original.pdf', { type: 'application/pdf' });
      const saved = await service.save(auth, 'NORMAL', first);
      assert.equal(saved.storage_kind, 'managed');
      assert.equal((await service.read(auth, 'NORMAL')).bytes.toString(), '%PDF-1.4\nfirst');
      await assert.rejects(service.read(other, 'NORMAL'), /无权访问/);
      assert.equal((await service.read(finance, 'NORMAL')).filename, 'receipt-original.pdf');

      const second = new File(['%PDF-1.4\nreplacement'], 'replacement.pdf', { type: 'application/pdf' });
      const replaced = await service.save(auth, 'NORMAL', second);
      assert.notEqual(replaced.storage_key, saved.storage_key);
      assert.deepEqual(await readdir(managed), [replaced.storage_key]);
      await assert.rejects(service.save(auth, 'LOCKED', first), /不能修改附件/);
      assert.deepEqual(await readdir(managed), [replaced.storage_key]);

      await mkdir(legacy, { recursive: true });
      await writeFile(path.join(legacy, 'LEGACY.pdf'), '%PDF-1.4\nlegacy');
      assert.equal((await service.read(auth, 'LEGACY')).bytes.toString(), '%PDF-1.4\nlegacy');
      const registered = (await db.query("SELECT * FROM otto_invoice_attachments WHERE invoiceno='LEGACY'")).rows[0];
      assert.equal(registered.storage_kind, 'legacy-invoice');
      const batch = await service.readMany(['NORMAL', 'LEGACY', 'MISSING']);
      assert.equal(batch.files.length, 2);
      assert.deepEqual(batch.missing, ['MISSING']);

      const oldSupplierId = randomUUID();
      await mkdir(supplierLegacy, { recursive: true });
      await writeFile(path.join(supplierLegacy, `${oldSupplierId}.pdf`), '%PDF-1.4\nold supplier');
      await db.query(`INSERT INTO otto_supplier_invoice_drafts
        (id,userid,filename,storage_key,storage_kind,content_type,file_size,status,header,saved_invoice_no)
        VALUES($1,'owner','supplier-original.pdf',$2,'legacy-supplier','application/pdf',21,'saved',$3::jsonb,'SUP-OLD')`,
      [oldSupplierId, `${oldSupplierId}.pdf`, JSON.stringify({ businesstype: '01' })]);
      await db.query(await readFile('../Backend/Database/migration/create_invoice_attachments.sql', 'utf8'));
      assert.equal((await service.read(auth, 'SUP-OLD')).bytes.toString(), '%PDF-1.4\nold supplier');

      const deletedAttachment = await service.save(auth, 'DELETE-ME', first);
      assert.equal(await service.deleteInvoice(other, 'DELETE-ME').catch(() => false), false);
      assert.equal(await service.deleteInvoice(auth, 'DELETE-ME'), true);
      assert.equal((await db.query("SELECT * FROM otto_invoice_attachments WHERE invoiceno='DELETE-ME'")).rowCount, 0);
      assert.ok(!(await readdir(managed)).includes(deletedAttachment.storage_key));
    } finally {
      await db.query('ROLLBACK');
      await db.end();
      await rm(root, { recursive: true, force: true });
    }
  });
