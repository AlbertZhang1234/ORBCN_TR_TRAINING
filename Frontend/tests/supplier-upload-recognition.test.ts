import assert from 'node:assert/strict';
import test from 'node:test';
import type { InvoiceParseResult } from '../services/Invoice/parse';
import { emptyHeader } from '../services/Invoice/supplier-draft-model';
import { SupplierDraftService } from '../services/_server/supplier-drafts/service';
import { processSupplierDraftById } from '../services/_server/supplier-drafts/worker';
import type { DraftRow, SupplierDraftRepository } from '../services/_server/supplier-drafts/repository';
import type { SupplierDraftFiles } from '../services/_server/supplier-drafts/files';
import type { InvoiceAttachmentRepository } from '../services/_server/invoice-attachments/repository';
import type { RequestAuthContext } from '../services/_server/requestAuth';

const auth = { userid: 'owner' } as RequestAuthContext;
const queued = (id = '11111111-1111-4111-8111-111111111111'): DraftRow => ({
  id, userid: auth.userid, filename: 'invoice.pdf', storage_key: `${id}.pdf`, storage_kind: 'managed',
  content_type: 'application/pdf', file_size: 12, status: 'queued', header: emptyHeader('01'), lines: [], version: 1,
});

test('supplier upload persists its task before running the shared recognition fast path', async () => {
  let inserted = false;
  let recognizedId = '';
  let removed = false;
  let created = queued();
  const repo = {
    transaction: async (work: (db: object) => Promise<unknown>) => work({ query: async (_sql: string, params: unknown[]) => {
      inserted = true;
      created = { ...created, id: String(params[0]) };
      return { rows: [created] };
    } }),
    byId: async () => ({ ...created, status: 'ready' as const, version: 3 }),
  } as unknown as SupplierDraftRepository;
  const files = {
    store: async () => ({ storage_key: created.storage_key, storage_kind: 'managed' as const, content_type: created.content_type }),
    remove: async () => { removed = true; },
  } as unknown as SupplierDraftFiles;
  const service = new SupplierDraftService(repo, files, 1024, {} as InvoiceAttachmentRepository, async (id) => {
    assert.equal(inserted, true);
    recognizedId = id;
    return true;
  });

  const result = await service.upload(auth, new File(['%PDF-1.4\ntest'], created.filename), '01');
  assert.equal(recognizedId, result.id);
  assert.equal(result.status, 'ready');
  assert.equal(removed, false);
});

test('failed fast-path startup leaves the durable upload queued for the worker', async () => {
  let removed = false;
  const row = queued('22222222-2222-4222-8222-222222222222');
  const repo = {
    transaction: async (work: (db: object) => Promise<unknown>) => work({ query: async () => ({ rows: [row] }) }),
    byId: async () => row,
  } as unknown as SupplierDraftRepository;
  const files = {
    store: async () => ({ storage_key: row.storage_key, storage_kind: 'managed' as const, content_type: row.content_type }),
    remove: async () => { removed = true; },
  } as unknown as SupplierDraftFiles;
  const service = new SupplierDraftService(repo, files, 1024, {} as InvoiceAttachmentRepository,
    async () => { throw new Error('temporary startup failure'); });

  const result = await service.upload(auth, new File(['%PDF-1.4\ntest'], row.filename), '01');
  assert.equal(result.status, 'queued');
  assert.equal(removed, false);
});

test('the synchronous fast path claims only its uploaded task and persists recognized content', async () => {
  const row = queued('33333333-3333-4333-8333-333333333333');
  let claimedId: string | undefined;
  let finished: { id: string; error: string | null; content: unknown } | undefined;
  const repo = {
    claim: async (_token: string, id?: string) => { claimedId = id; return row; },
    finish: async (id: string, _token: string, content: unknown, _result: unknown, error: string | null) => {
      finished = { id, error, content };
    },
  } as unknown as SupplierDraftRepository;
  const files = { read: async () => Buffer.from('%PDF-1.4\ntest') } as unknown as SupplierDraftFiles;
  const parsed: InvoiceParseResult = { invoice_number: 'FAST-1', line_items: [{ description: 'Item' }] };

  assert.equal(await processSupplierDraftById(repo, files, async () => parsed, row.id), true);
  assert.equal(claimedId, row.id);
  assert.equal(finished?.id, row.id);
  assert.equal(finished?.error, null);
  assert.equal((finished?.content as { header: { invoiceno: string } }).header.invoiceno, 'FAST-1');
});
