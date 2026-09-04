import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import path from 'node:path';
import { mkdtemp, readFile, readdir, unlink, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { SupplierDraftRepository } from '../services/_server/supplier-drafts/repository';
import { SupplierDraftFiles } from '../services/_server/supplier-drafts/files';
import { SupplierDraftService } from '../services/_server/supplier-drafts/service';
import { SupplierSourceService } from '../services/_server/supplier-drafts/source';
import { processNextSupplierDraft } from '../services/_server/supplier-drafts/worker';
import { InvoiceAttachmentRepository } from '../services/_server/invoice-attachments/repository';
import { InvoiceAttachmentService } from '../services/_server/invoice-attachments/service';
import type { RequestAuthContext } from '../services/_server/requestAuth';

const auth: RequestAuthContext = { userid: 'test-owner', sessionId: 'test', roleids: [], permissions: { isAdmin: false, isFinance: false, isProjectManager: false } };
const other = { ...auth, userid: 'other-user' };
const parsed = { invoice_number: 'TEST-SUPPLIER', issue_date: '2026-09-03', amount_excl_tax: 10, amount_incl_tax: 11.3,
  line_items: [{ description: 'Item', quantity: 1, unit_price: 10, amount_excl_tax: 10, amount_incl_tax: 11.3, tax_rate: '13%' }] };

test('durable upload, background completion, restore, edits, atomic save, permissions and original file',
  { skip: !process.env.SUPPLIER_DRAFT_INTEGRATION }, async () => {
    const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    const root = await mkdtemp(path.join(tmpdir(), 'supplier-draft-test-'));
    const schema = `supplier_test_${randomUUID().replaceAll('-', '')}`;
    let savepoint = 0;
    try {
      await db.query('BEGIN');
      await db.query(`CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}",public`);
      await db.query('CREATE TABLE otto_invoices (LIKE public.otto_invoices INCLUDING ALL)');
      await db.query('CREATE TABLE otto_invoice_lines (LIKE public.otto_invoice_lines INCLUDING ALL)');
      await db.query(await readFile(path.resolve('../Backend/Database/migration/create_supplier_invoice_drafts.sql'), 'utf8'));
      await db.query(await readFile(path.resolve('../Backend/Database/migration/create_invoice_attachments.sql'), 'utf8'));
      const repo = new SupplierDraftRepository(async (work) => {
        const point = `sp${++savepoint}`;
        await db.query(`SAVEPOINT ${point}`);
        try { const result = await work(db as unknown as pg.PoolClient); await db.query(`RELEASE SAVEPOINT ${point}`); return result; }
        catch (error) { await db.query(`ROLLBACK TO SAVEPOINT ${point}`); throw error; }
      });
      const files = new SupplierDraftFiles(root, root, root);
      const attachmentRepo = new InvoiceAttachmentRepository(repo.transaction);
      const attachmentService = new InvoiceAttachmentService(attachmentRepo, files, 1024 * 1024);
      const service = new SupplierDraftService(repo, files, 1024 * 1024, attachmentRepo);
      const source = new SupplierSourceService(repo, files, attachmentService);
      const pdf = new File(['%PDF-1.4\ntest fixture'], 'original.pdf', { type: 'application/pdf' });
      const uploaded = await service.upload(auth, pdf, '01');
      assert.equal(uploaded.status, 'queued');
      assert.equal((await new SupplierDraftService(repo, files, 1024, attachmentRepo).list(auth))[0].id, uploaded.id);
      assert.equal((await service.list(other)).length, 0);
      assert.equal(await processNextSupplierDraft(repo, files, async () => parsed), true);
      let restored = (await service.list(auth))[0];
      assert.equal(restored.status, 'ready');
      assert.equal(restored.lines[0].description, 'Item');
      await assert.rejects(source.read(other, restored.id, null), /无权访问/);
      await assert.rejects(service.patch(auth, restored.id, { ...restored, header: { ...restored.header, businesstype: '03' as any } }), /01 或 02/);
      const before = restored;
      restored = await service.patch(auth, restored.id, { ...restored, header: { ...restored.header, invoiceno: 'CHANGED-INVOICE-NO', businesstype: '02' },
        lines: [{ ...restored.lines[0], description: 'Edited item', quantity: 2, spec_model: 'Model A' }] });
      await assert.rejects(service.patch(auth, restored.id, before), /已在其他页面更新/);
      const draftOriginal = await source.read(auth, restored.id, null);
      assert.equal(draftOriginal.bytes.toString(), '%PDF-1.4\ntest fixture');
      await assert.rejects(service.action(auth, restored.id, 'confirm', restored.version), /Invalid action/);
      const saved = await service.action(auth, restored.id, 'save', restored.version);
      assert.equal(saved.status, 'saved');
      assert.deepEqual(await service.list(auth), []); // Saved invoices leave the recognition workbench.
      assert.equal((await db.query('SELECT status FROM otto_supplier_invoice_drafts WHERE id=$1', [saved.id])).rows[0].status, 'saved');
      assert.deepEqual(await new SupplierDraftService(repo, files, 1024, attachmentRepo).list(auth), []);
      assert.equal((await service.action(auth, restored.id, 'save', restored.version)).status, 'saved');
      assert.equal((await source.read(auth, null, 'CHANGED-INVOICE-NO')).bytes.toString(), draftOriginal.bytes.toString());
      await assert.rejects(source.read(other, null, 'CHANGED-INVOICE-NO'), /无权访问/);
      const invoice = (await db.query('SELECT * FROM otto_invoices')).rows[0];
      assert.equal(invoice.businesstype, '02');
      assert.equal(invoice.userid, auth.userid);
      const attachment = (await db.query('SELECT * FROM otto_invoice_attachments')).rows[0];
      assert.equal(attachment.invoiceno, 'CHANGED-INVOICE-NO');
      assert.equal(attachment.storage_kind, 'managed');
      assert.equal((await db.query('SELECT * FROM otto_invoice_lines')).rows[0].description, 'Edited item');
      const second = await service.upload(auth, pdf, '01');
      await db.query("UPDATE otto_supplier_invoice_drafts SET status='recognizing',lease_until=now()-interval '1 minute' WHERE id=$1", [second.id]);
      assert.equal(await processNextSupplierDraft(repo, files, async () => ({ ...parsed, invoice_number: 'CHANGED-INVOICE-NO' })), true);
      const duplicate = (await service.list(auth)).find((row) => row.id === second.id)!;
      await assert.rejects(service.action(auth, duplicate.id, 'save', duplicate.version), /already exists/);
      assert.equal((await db.query('SELECT * FROM otto_invoices')).rows.length, 1);
      assert.equal((await service.list(auth)).find((row) => row.id === second.id)!.status, 'ready');
      // Simulate an existing deployment, then verify lossless migration of its review state.
      await db.query('ALTER TABLE otto_supplier_invoice_drafts DROP CONSTRAINT otto_supplier_invoice_drafts_status_check');
      await db.query("UPDATE otto_supplier_invoice_drafts SET status='confirmed' WHERE id=$1", [second.id]);
      await db.query(await readFile('../Backend/Database/migration/remove_supplier_invoice_draft_confirmation.sql', 'utf8'));
      const migrated = (await service.list(auth)).find((row) => row.id === second.id)!;
      assert.equal(migrated.status, 'ready');
      assert.equal(migrated.version, duplicate.version + 1);
      assert.deepEqual(migrated.header, duplicate.header);
      assert.deepEqual(migrated.lines, duplicate.lines);
      assert.equal((await source.read(auth, second.id, null)).bytes.toString(), draftOriginal.bytes.toString());
      const third = await service.upload(auth, pdf, '01');
      await processNextSupplierDraft(repo, files, async () => ({ ...parsed, invoice_number: 'ROLLBACK-ME', line_items: [{ description: 'REJECT-LINE' }] }));
      await db.query("ALTER TABLE otto_invoice_lines ADD CONSTRAINT test_fail_line CHECK(description <> 'REJECT-LINE')");
      const failing = (await service.list(auth)).find((row) => row.id === third.id)!;
      await assert.rejects(service.action(auth, failing.id, 'save', failing.version));
      assert.equal((await db.query("SELECT * FROM otto_invoices WHERE invoiceno='ROLLBACK-ME'")).rowCount, 0);
      assert.equal((await service.list(auth)).find((row) => row.id === third.id)!.status, 'ready');
      await db.query("INSERT INTO otto_invoices(invoiceno,userid,businesstype) VALUES('LEGACY','test-owner','01')");
      await writeFile(path.join(root, 'LEGACY.pdf'), '%PDF-1.4\nlegacy fixture');
      assert.equal((await source.read(auth, null, 'LEGACY')).bytes.toString(), '%PDF-1.4\nlegacy fixture');
      await assert.rejects(service.upload(auth, pdf, '03'), /01 或 02/);
      assert.throws(() => files.read('managed', '../escape.pdf'), /Invalid managed file key/);
    } finally {
      await db.query('ROLLBACK');
      await db.end();
      for (const name of await readdir(root)) await unlink(path.join(root, name));
      await rmdir(root);
    }
  });
