import assert from 'node:assert/strict';
import test from 'node:test';
import { SupplierDraftStore } from '../services/Invoice/supplier-draft-store';
import { emptyHeader, type SupplierInvoiceDraft } from '../services/Invoice/supplier-draft-model';

const row = (): SupplierInvoiceDraft => ({ id: 'draft', filename: 'invoice.pdf', status: 'ready', version: 1, header: emptyHeader('01'), lines: [] });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const api = () => ({
  list: async () => [row()], upload: async () => row(),
  patch: async (value: SupplierInvoiceDraft) => ({ ...value, version: value.version + 1 }),
  action: async (value: SupplierInvoiceDraft, action: string) => ({ ...value, status: action === 'save' ? 'saved' : 'queued', version: value.version + 1 } as SupplierInvoiceDraft),
});
test('an upload finishes after its page unsubscribes and is available on return', async () => {
  const uploaded = deferred<SupplierInvoiceDraft>();
  const store = new SupplierDraftStore({ ...api(), upload: () => uploaded.promise });
  const unsubscribe = store.subscribe(() => undefined);
  const pending = store.upload([{} as File], '01');
  unsubscribe(); // route unmounted, shell-scoped store remains alive
  uploaded.resolve(row());
  await pending;
  assert.equal(store.getSnapshot().drafts.length, 1);
  assert.equal(store.getSnapshot().uploading, 0);
});
test('autosave serializes edits, preserves latest fields and does not let polling overwrite them', async () => {
  const first = deferred<SupplierInvoiceDraft>();
  const calls: SupplierInvoiceDraft[] = [];
  const store = new SupplierDraftStore({ ...api(), patch: async (value) => {
    calls.push(value);
    return calls.length === 1 ? first.promise : { ...value, version: value.version + 1 };
  } });
  await store.upload([{} as File], '01');
  store.edit('draft', { header: { ...row().header, supplier: 'first' } });
  store.edit('draft', { header: { ...row().header, supplier: 'latest' } });
  first.resolve({ ...calls[0], version: 2 });
  await store.flush('draft');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].version, 2);
  assert.equal(store.getSnapshot().drafts[0].header.supplier, 'latest');
  assert.equal(store.getSnapshot().drafts[0].version, 3);
  assert.deepEqual(store.getSnapshot().dirty, []);
});
test('formal save waits for draft persistence', async () => {
  const order: string[] = [];
  const store = new SupplierDraftStore({ ...api(), patch: async (value) => {
    order.push('patch'); return { ...value, version: 2 };
  }, action: async (value) => { order.push('save'); assert.equal(value.version, 2); return { ...value, status: 'saved', version: 3 }; } });
  await store.upload([{} as File], '01');
  store.edit('draft', { header: { ...row().header, invoiceno: 'edited' } });
  await store.action('draft', 'save');
  assert.deepEqual(order, ['patch','save']);
  assert.deepEqual(store.getSnapshot().drafts, []);
});
test('failed autosave keeps pending content for retry', async () => {
  let fail = true;
  const store = new SupplierDraftStore({ ...api(), patch: async (value) => {
    if (fail) throw new Error('offline');
    return { ...value, version: 2 };
  } });
  await store.upload([{} as File], '01');
  store.edit('draft', { header: { ...row().header, supplier: 'keep me' } });
  await store.flush('draft').catch(() => undefined);
  assert.deepEqual(store.getSnapshot().dirty, ['draft']);
  fail = false;
  await store.flush('draft');
  assert.equal(store.getSnapshot().drafts[0].header.supplier, 'keep me');
  assert.deepEqual(store.getSnapshot().dirty, []);
});

test('a stale list response cannot restore a saved task to the pending list', async () => {
  const listed = deferred<SupplierInvoiceDraft[]>();
  const store = new SupplierDraftStore({ ...api(), list: () => listed.promise });
  await store.upload([{} as File], '01');
  store.activate();
  await store.action('draft', 'save');
  listed.resolve([row()]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(store.getSnapshot().drafts, []);
});

test('save all saves ready/edited/error drafts without confirmation, skips processing and continues after failure', async () => {
  const statuses = ['ready', 'editing', 'error', 'saved', 'queued', 'recognizing', 'ready'] as const;
  const records = statuses.map((status, index) => ({ ...row(), id: `draft-${index}`, filename: `${index}.pdf`, status }));
  const calls: string[] = [];
  const store = new SupplierDraftStore({ ...api(), upload: async () => records.shift()!, action: async (value, action) => {
    assert.equal(action, 'save');
    calls.push(value.id);
    if (value.id === 'draft-2') throw new Error('发票号码不能为空');
    return { ...value, status: 'saved', version: value.version + 1 };
  } });
  await store.upload(statuses.map(() => ({} as File)), '01');
  const result = await store.saveAll();
  assert.equal(result.total, 6);
  assert.equal(result.saved, 3);
  assert.equal(result.skipped.length, 2);
  assert.deepEqual(result.failed, [{ filename: '2.pdf', reason: '发票号码不能为空' }]);
  assert.equal(calls.length, 4);
  assert.ok(calls.includes('draft-0') && calls.includes('draft-1') && calls.includes('draft-6'));
  assert.equal(store.getSnapshot().drafts.find((item) => item.id === 'draft-2')!.status, 'error');
  assert.equal(store.getSnapshot().drafts.length, 3);
  assert.ok(store.getSnapshot().drafts.every((item) => item.status !== 'saved'));
  assert.equal(store.getSnapshot().savingAll, false);
});

test('initial loading excludes saved tasks and a fresh store does not restore them', async () => {
  const records: SupplierInvoiceDraft[] = [row(), { ...row(), id: 'saved', status: 'saved' }];
  for (let visit = 0; visit < 2; visit++) {
    const store = new SupplierDraftStore({ ...api(), list: async () => records });
    store.activate();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(store.getSnapshot().drafts.map((item) => item.id), ['draft']);
  }
});

test('polling removes tasks saved in another tab', async () => {
  const store = new SupplierDraftStore({ ...api(), list: async () => [] });
  await store.upload([{} as File], '01');
  store.activate();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(store.getSnapshot().drafts, []);
});

test('a list requested before an upload completed cannot discard that new task', async () => {
  const listed = deferred<SupplierInvoiceDraft[]>();
  const store = new SupplierDraftStore({ ...api(), list: () => listed.promise });
  store.activate();
  await store.upload([{} as File], '01');
  listed.resolve([]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(store.getSnapshot().drafts[0].id, 'draft');
});

test('an omitted task with unsynced edits is retained instead of silently losing edits', async () => {
  const store = new SupplierDraftStore({ ...api(), list: async () => [], patch: async () => { throw new Error('offline'); } });
  await store.upload([{} as File], '01');
  store.edit('draft', { header: { ...row().header, supplier: 'Unsynced' } });
  await store.flush('draft').catch(() => undefined);
  store.activate();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(store.getSnapshot().drafts[0].header.supplier, 'Unsynced');
  assert.deepEqual(store.getSnapshot().dirty, ['draft']);
});

test('a batch continues if another tab saves a later task while the first is saving', async () => {
  const first = deferred<SupplierInvoiceDraft>();
  let records = [row(), { ...row(), id: 'second', filename: 'second.pdf' }];
  const store = new SupplierDraftStore({ ...api(), list: async () => records, action: () => first.promise });
  store.activate();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const saving = store.saveAll();
  await new Promise((resolve) => setTimeout(resolve, 0));
  records = [];
  await store.refresh();
  assert.deepEqual(store.getSnapshot().drafts.map((item) => item.id), ['draft']);
  first.resolve({ ...row(), status: 'saved', version: 2 });
  const result = await saving;
  assert.equal(result.saved, 1);
  assert.equal(result.skipped[0].filename, 'second.pdf');
  assert.equal(result.failed.length, 0);
  assert.deepEqual(store.getSnapshot().drafts, []);
});

test('save all waits for latest autosave and prevents duplicate batches and mid-batch edits', async () => {
  const patched = deferred<SupplierInvoiceDraft>();
  const calls: SupplierInvoiceDraft[] = [];
  const store = new SupplierDraftStore({ ...api(), patch: () => patched.promise, action: async (value) => {
    calls.push(value); return { ...value, status: 'saved', version: value.version + 1 };
  } });
  await store.upload([{} as File], '01');
  const header = { ...row().header, invoiceno: 'LATEST-EDIT' };
  store.edit('draft', { header });
  const batch = store.saveAll();
  await assert.rejects(store.saveAll(), /正在批量保存/);
  store.edit('draft', { header: { ...header, invoiceno: 'DO-NOT-CHANGE' } });
  patched.resolve({ ...row(), header, status: 'editing', version: 2 });
  const result = await batch;
  assert.equal(result.saved, 1);
  assert.equal(calls[0].header.invoiceno, 'LATEST-EDIT');
  assert.equal(calls[0].version, 2);
  assert.deepEqual(store.getSnapshot().dirty, []);
  assert.equal(store.getSnapshot().savingAll, false);
});

test('save all saves ready/edited/error drafts without confirmation, skips processing and continues after failure', async () => {
  const statuses = ['ready', 'editing', 'error', 'saved', 'queued', 'recognizing', 'ready'] as const;
  const records = statuses.map((status, index) => ({ ...row(), id: `draft-${index}`, filename: `${index}.pdf`, status }));
  const calls: string[] = [];
  const store = new SupplierDraftStore({ ...api(), upload: async () => records.shift()!, action: async (value, action) => {
    assert.equal(action, 'save');
    calls.push(value.id);
    if (value.id === 'draft-2') throw new Error('发票号码不能为空');
    return { ...value, status: 'saved', version: value.version + 1 };
  } });
  await store.upload(statuses.map(() => ({} as File)), '01');
  const result = await store.saveAll();
  assert.equal(result.total, 6);
  assert.equal(result.saved, 3);
  assert.equal(result.skipped.length, 2);
  assert.deepEqual(result.failed, [{ filename: '2.pdf', reason: '发票号码不能为空' }]);
  assert.equal(calls.length, 4);
  assert.ok(calls.includes('draft-0') && calls.includes('draft-1') && calls.includes('draft-6'));
  assert.equal(store.getSnapshot().drafts.find((item) => item.id === 'draft-2')!.status, 'error');
  assert.equal(store.getSnapshot().savingAll, false);
});

test('save all waits for latest autosave and prevents duplicate batches and mid-batch edits', async () => {
  const patched = deferred<SupplierInvoiceDraft>();
  const calls: SupplierInvoiceDraft[] = [];
  const store = new SupplierDraftStore({ ...api(), patch: () => patched.promise, action: async (value) => {
    calls.push(value); return { ...value, status: 'saved', version: value.version + 1 };
  } });
  await store.upload([{} as File], '01');
  const header = { ...row().header, invoiceno: 'LATEST-EDIT' };
  store.edit('draft', { header });
  const batch = store.saveAll();
  await assert.rejects(store.saveAll(), /正在批量保存/);
  store.edit('draft', { header: { ...header, invoiceno: 'DO-NOT-CHANGE' } });
  patched.resolve({ ...row(), header, status: 'editing', version: 2 });
  const result = await batch;
  assert.equal(result.saved, 1);
  assert.equal(calls[0].header.invoiceno, 'LATEST-EDIT');
  assert.equal(calls[0].version, 2);
  assert.deepEqual(store.getSnapshot().dirty, []);
  assert.equal(store.getSnapshot().savingAll, false);
});
