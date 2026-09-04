import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, readdir, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function stop(child?: ChildProcess) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => { child.once('exit', () => resolve()); child.kill(); });
}

test('HTTP upload survives navigation, background completion and server restart; saved original remains viewable',
  { skip: !process.env.SUPPLIER_DRAFT_HTTP, timeout: 150_000 }, async () => {
    const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
    const root = await mkdtemp(path.join(tmpdir(), 'supplier-http-test-'));
    const schema = `supplier_http_${randomUUID().replaceAll('-', '')}`;
    const session = randomUUID();
    let child: ChildProcess | undefined;
    let logs = '';
    const fake = createServer(async (req, res) => {
      for await (const chunk of req) { /* Drain uploaded fixture; never call an external model. */ }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ invoice_number: 'HTTP-FIXTURE', seller_name: 'Fixture Supplier',
        line_items: [{ description: 'Fixture Item', quantity: 1, unit_price: 20, amount_excl_tax: 20, amount_incl_tax: 22.6, tax_rate: '13%' }] }));
    });
    await db.connect();
    try {
      await db.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"`);
      await db.query('CREATE TABLE otto_invoices (LIKE public.otto_invoices INCLUDING ALL)');
      await db.query('CREATE TABLE otto_invoice_lines (LIKE public.otto_invoice_lines INCLUDING ALL)');
      await db.query(`CREATE TABLE t_loginsessions(session_id text, userid text, expires_at timestamptz, is_active boolean, updated_at timestamptz, last_accessed_at timestamptz);
        CREATE TABLE otto_userrole(userid text,roleid text);
        CREATE TABLE otto_project(projectid text,projectmanager text);
        CREATE TABLE otto_travelentry(travelid text,projectid text);
        CREATE TABLE otto_booking_rule(code text,is_active boolean,sort_order integer);
        INSERT INTO otto_booking_rule VALUES('TEST',true,1)`);
      await db.query("INSERT INTO t_loginsessions VALUES($1,'http-user',now()+interval '1 hour',true,now(),now())", [session]);
      await db.query(await readFile('../Backend/Database/migration/create_supplier_invoice_drafts.sql', 'utf8'));
      await db.query(await readFile('../Backend/Database/migration/create_invoice_attachments.sql', 'utf8'));
      await db.query(await readFile('../Backend/Database/migration/create_system_config.sql', 'utf8'));
      await new Promise<void>((resolve) => fake.listen(0, '127.0.0.1', resolve));
      const fakePort = (fake.address() as { port: number }).port;
      const connection = new URL(process.env.DATABASE_URL!);
      connection.searchParams.set('options', `-c search_path=${schema}`);
      const base = 'http://127.0.0.1:18200';
      const start = async () => {
        child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname','127.0.0.1','--port','18200'], {
          windowsHide: true, stdio: ['ignore','pipe','pipe'], env: { ...process.env,
            DATABASE_URL: connection.toString(), NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || '.next-supplier-check',
            INVOICE_ATTACHMENT_STORAGE_DIR: root, SUPPLIER_INVOICE_STORAGE_DIR: root, SUPPLIER_DRAFT_WORKER_DISABLED: '0',
            INVOICE_PARSE_ENDPOINT: `http://127.0.0.1:${fakePort}/classify`,
          },
        });
        child.stdout?.on('data', (chunk) => { logs = (logs + chunk).slice(-6000); });
        child.stderr?.on('data', (chunk) => { logs = (logs + chunk).slice(-6000); });
        for (let attempt = 0; attempt < 100; attempt++) {
          if (child.exitCode !== null) throw new Error(`Test server exited: ${logs}`);
          if (await fetch(base).then((r) => r.ok).catch(() => false)) return;
          await delay(300);
        }
        throw new Error(`Test server did not start: ${logs}`);
      };
      const request = async (url: string, init: RequestInit = {}) => {
        const response = await fetch(base + url, { ...init, headers: { ...init.headers, 'x-session-id': session } });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        return response;
      };
      const upload = async () => {
        const form = new FormData();
        form.append('file', new File(['%PDF-1.4\nHTTP fixture'], 'fixture.pdf', { type: 'application/pdf' }));
        form.append('businesstype','01');
        return (await request('/api/supplier-invoices/drafts', { method: 'POST', body: form })).json();
      };
      const ready = async (id: string) => {
        for (let attempt = 0; attempt < 60; attempt++) {
          const rows = await (await request('/api/supplier-invoices/drafts')).json();
          const row = rows.find((r: any) => r.id === id);
          if (row?.status === 'ready') return row;
          if (row?.status === 'error') throw new Error(row.error);
          await delay(300);
        }
        throw new Error(`Worker did not finish: ${logs}`);
      };
      await start();
      assert.equal((await fetch(base+'/api/supplier-invoices/drafts')).status, 401);
      const uploaded = await upload();
      await fetch(base+'/pc/home'); // leave workbench; no recognition call from browser
      await delay(2500);
      let row = await ready(uploaded.id);
      assert.equal(row.lines[0].description, 'Fixture Item');
      row = await (await request(`/api/supplier-invoices/drafts/${row.id}`, {
        method: 'PATCH', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ ...row, header: { ...row.header, invoiceno: 'HTTP-EDITED' } }),
      })).json();
      row = await (await request(`/api/supplier-invoices/drafts/${row.id}`, {
        method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ action:'save',version:row.version }),
      })).json();
      assert.equal(row.status,'saved');
      assert.equal(await (await request('/api/supplier-invoices/source?invoiceNo=HTTP-EDITED')).text(), '%PDF-1.4\nHTTP fixture');
      const second = await upload();
      await stop(child); child = undefined;
      await db.query("UPDATE otto_supplier_invoice_drafts SET status='recognizing',lease_until=now()-interval '1 second' WHERE id=$1", [second.id]);
      await start();
      assert.equal((await ready(second.id)).status, 'ready');
      assert.equal(await (await request(`/api/supplier-invoices/source?draftId=${second.id}`)).text(), '%PDF-1.4\nHTTP fixture');
    } finally {
      await stop(child);
      await new Promise<void>((resolve) => fake.close(() => resolve()));
      if (!/^supplier_http_[a-f0-9]{32}$/.test(schema)) throw new Error('Unsafe test schema cleanup target');
      await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await db.end();
      for (const name of await readdir(root)) await unlink(path.join(root,name));
      await rmdir(root);
    }
  });
