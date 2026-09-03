import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import path from 'node:path';
import { mkdtemp, readFile, readdir, unlink, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { SupplierInvoiceEditService } from '../services/_server/supplier-invoices/service';
import { SupplierDraftFiles } from '../services/_server/supplier-drafts/files';
import { SupplierDraftRepository } from '../services/_server/supplier-drafts/repository';
import { SupplierSourceService } from '../services/_server/supplier-drafts/source';
import { createSupplierInvoiceWithLines } from '../services/_server/supplierInvoiceRecognition';
import type { RequestAuthContext } from '../services/_server/requestAuth';
import { emptyHeader } from '../services/Invoice/supplier-draft-model';
import { supplierInvoiceContent } from '../services/Invoice/supplier-edit-model';

const auth: RequestAuthContext = { userid: 'owner', sessionId: 'test', roleids: [],
  permissions: { isAdmin: false, isFinance: false, isProjectManager: false } };
const other = { ...auth, userid: 'other' };
const finance = { ...other, permissions: { ...auth.permissions, isFinance: true } };

test('database numeric strings and nulls are editable without losing zero values', () => {
  const value = supplierInvoiceContent({ ...emptyHeader('02'), invoiceno: 'TEST', grossamount: '0', taxamount: null },
    [{ seqno: 2, description: 'Item', quantity: '2.5', amount_excl_tax: '0', spec_model: null }]);
  assert.equal(value.header.grossamount, 0);
  assert.equal(value.header.taxamount, null);
  assert.equal(value.lines[0].quantity, 2.5);
  assert.equal(value.lines[0].amount_excl_tax, 0);
  assert.equal(value.lines[0].spec_model, '');
});

test('saved supplier invoices edit atomically, preserve originals on rename and enforce permissions',
  { skip: !process.env.SUPPLIER_EDIT_INTEGRATION }, async () => {
    const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    const root = await mkdtemp(path.join(tmpdir(), 'supplier-edit-test-'));
    const schema = `supplier_edit_${randomUUID().replaceAll('-', '')}`;
    let savepoint = 0;
    try {
      await db.query('BEGIN');
      await db.query(`CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}",public`);
      await db.query(`CREATE TABLE otto_invoices (LIKE public.otto_invoices INCLUDING ALL);
        CREATE TABLE otto_invoice_lines (LIKE public.otto_invoice_lines INCLUDING ALL);
        CREATE TABLE otto_user(userid text PRIMARY KEY);
        CREATE TABLE otto_travelentry(travelid text PRIMARY KEY);
        CREATE TABLE otto_tr_t(id integer, invoiceno text REFERENCES otto_invoices(invoiceno));
        ALTER TABLE otto_invoice_lines ADD FOREIGN KEY(invoiceno) REFERENCES otto_invoices(invoiceno) ON DELETE CASCADE;
        ALTER TABLE otto_invoices ADD FOREIGN KEY(travelid) REFERENCES otto_travelentry(travelid);
        INSERT INTO otto_user VALUES('owner'),('other'); INSERT INTO otto_travelentry VALUES('TR-1');`);
      await db.query(await readFile('../Backend/Database/migration/create_supplier_invoice_drafts.sql', 'utf8'));
      const repo = new SupplierDraftRepository(async (work) => {
        const point = `sp${++savepoint}`;
        await db.query(`SAVEPOINT ${point}`);
        try { const result = await work(db as unknown as pg.PoolClient); await db.query(`RELEASE SAVEPOINT ${point}`); return result; }
        catch (error) { await db.query(`ROLLBACK TO SAVEPOINT ${point}`); throw error; }
      });
      const files = new SupplierDraftFiles(root, root);
      const service = new SupplierInvoiceEditService(repo.transaction, files);
      const source = new SupplierSourceService(repo, files);
      await createSupplierInvoiceWithLines({ withTransaction: repo.transaction }, auth,
        { ...emptyHeader('01'), invoiceno: 'ORIGINAL', supplier: 'Supplier', invoicedate: '2026-09-03', grossamount: 113 },
        [{ description: 'Item', quantity: 1, unit_price: 100, amount_excl_tax: 100, amount_incl_tax: 113, tax_rate: '13%' }]);
      await writeFile(path.join(root, 'ORIGINAL.pdf'), '%PDF-1.4\noriginal fixture');
      let detail = await service.load(auth, 'ORIGINAL');
      assert.equal(detail.header.originalamount, 113);
      assert.equal(detail.lines[0].description, 'Item');
      await assert.rejects(service.load(other, 'ORIGINAL'), /无权访问/);
      await assert.rejects(service.save(other, 'ORIGINAL', detail), /无权访问/);
      await assert.rejects(service.load(auth, 'MISSING'), /不存在/);
      assert.equal((await service.load(finance, 'ORIGINAL')).header.userid, 'owner');
      const original = structuredClone(detail);
      detail.header = { ...detail.header, supplier: '', description: 'Changed', comment: '', travelid: 'TR-1',
        bookingcode: 'SOBE', businesstype: '02', invoicedate: '2026-09-02', currency: 'eur',
        totalnetamount: 20, taxamount: 2, grossamount: 22, originalcurrency: 'usd', originalamount: 25 };
      detail.lines = [{ ...detail.lines[0], description: 'Changed item', quantity: 2, spec_model: 'Model A',
        unit_price: 5, amount_excl_tax: 10, amount_incl_tax: 11 },
      { ...detail.lines[0], key: 'copy', description: 'Copied item', amount_excl_tax: 10, amount_incl_tax: 11 }];
      const saved = await service.save(auth, 'ORIGINAL', detail);
      detail = await service.load(auth, 'ORIGINAL');
      assert.deepEqual(detail, saved);
      assert.equal(detail.header.supplier, '');
      assert.equal(detail.header.currency, 'EUR');
      assert.equal(detail.header.originalcurrency, 'USD');
      assert.equal(detail.lines.length, 2);
      assert.equal(detail.lines[0].quantity, 2);
      await assert.rejects(service.save(auth, 'ORIGINAL', original), /其他页面修改/);
      await assert.rejects(service.save(auth, 'ORIGINAL', { ...detail, lines: [] }), /至少需要/);
      await assert.rejects(service.save(auth, 'ORIGINAL', { ...detail, header: { ...detail.header, status: 'BOOKED' } }), /流程状态/);
      await assert.rejects(service.save(auth, 'ORIGINAL', { ...detail, header: { ...detail.header, userid: 'other' } }), /所属用户/);
      await assert.rejects(service.save(auth, 'ORIGINAL', { ...detail, header: { ...detail.header, travelid: 'MISSING' } }), /差旅记录不存在/);
      await assert.rejects(service.save(auth, 'ORIGINAL', { ...detail, header: { ...detail.header, invoicedate: '2026-02-31' } }), /日期无效/);
      await db.query("ALTER TABLE otto_invoice_lines ADD CONSTRAINT reject_line CHECK(description <> 'REJECT')");
      await assert.rejects(service.save(auth, 'ORIGINAL', { ...detail, header: { ...detail.header, comment: 'Must roll back' },
        lines: [{ ...detail.lines[0], description: 'REJECT' }] }));
      assert.deepEqual(await service.load(auth, 'ORIGINAL'), detail);
      await db.query("INSERT INTO otto_tr_t VALUES(1,'ORIGINAL')");
      const renamed = await service.save(auth, 'ORIGINAL', { ...detail,
        header: { ...detail.header, invoiceno: 'RENAMED', travelid: '', taxamount: null }, lines: [detail.lines[1]] });
      await assert.rejects(service.load(auth, 'ORIGINAL'), /不存在/);
      assert.equal(renamed.header.invoiceno, 'RENAMED');
      assert.equal(renamed.header.travelid, '');
      assert.equal(renamed.header.taxamount, null);
      assert.equal(renamed.lines.length, 1);
      assert.equal((await db.query('SELECT invoiceno FROM otto_tr_t')).rows[0].invoiceno, 'RENAMED');
      assert.equal((await source.read(auth, null, 'RENAMED')).bytes.toString(), '%PDF-1.4\noriginal fixture');
      await assert.rejects(source.read(other, null, 'RENAMED'), /无权访问/);
      const draft = (await db.query('SELECT * FROM otto_supplier_invoice_drafts')).rows[0];
      assert.equal(draft.header.invoiceno, 'RENAMED');
      assert.equal(draft.lines[0].description, 'Copied item');
      detail = await service.save(auth, 'RENAMED', { ...renamed, header: { ...renamed.header, invoiceno: 'RENAMED-AGAIN' } });
      assert.equal((await source.read(finance, null, 'RENAMED-AGAIN')).bytes.toString(), '%PDF-1.4\noriginal fixture');
      assert.equal((await db.query('SELECT * FROM otto_supplier_invoice_drafts')).rowCount, 1);
      await db.query("INSERT INTO otto_invoices(invoiceno,userid,businesstype) VALUES('DUPLICATE','owner','01')");
      await assert.rejects(service.save(auth, 'RENAMED-AGAIN', { ...detail, header: { ...detail.header, invoiceno: 'DUPLICATE' } }), /已存在/);
      assert.deepEqual(await service.load(auth, 'RENAMED-AGAIN'), detail);
      detail = await service.save(finance, 'RENAMED-AGAIN', { ...detail, header: { ...detail.header, userid: 'other' } });
      assert.equal((await service.load(other, 'RENAMED-AGAIN')).header.userid, 'other');
      for (const status of ['SUBMITTED', 'BOOKED', '已提交', '已记账', '已回传SAP系统']) {
        await db.query('UPDATE otto_invoices SET status=$1 WHERE invoiceno=$2', [status, 'RENAMED-AGAIN']);
        detail = await service.load(other, 'RENAMED-AGAIN');
        await assert.rejects(service.save(other, 'RENAMED-AGAIN', detail), /不能修改/);
      }
      // A failed rename of a legacy invoice must also remove the temporary file copy.
      await db.query("INSERT INTO otto_invoice_lines(invoiceno,seqno,description) VALUES('DUPLICATE',1,'Item')");
      await writeFile(path.join(root, 'DUPLICATE.pdf'), '%PDF-1.4\nsecond original');
      detail = await service.load(auth, 'DUPLICATE');
      const filenames = await readdir(root);
      await assert.rejects(service.save(auth, 'DUPLICATE', { ...detail, header: { ...detail.header, invoiceno: 'ROLLBACK' },
        lines: [{ ...detail.lines[0], description: 'REJECT' }] }));
      assert.deepEqual(await readdir(root), filenames);
      assert.equal((await service.load(auth, 'DUPLICATE')).header.invoiceno, 'DUPLICATE');
      await assert.rejects(service.load(auth, 'ROLLBACK'), /不存在/);
    } finally {
      await db.query('ROLLBACK');
      await db.end();
      for (const name of await readdir(root)) await unlink(path.join(root, name));
      await rmdir(root);
    }
  });
