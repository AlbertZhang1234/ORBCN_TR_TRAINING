import assert from 'node:assert/strict';
import test from 'node:test';
import { mapConcurrent } from '../services/_core/concurrency';
import { defaultRecognitionSettings, validateRecognitionSettings } from '../services/SystemConfig/model';
import { createRecognitionService, type RecognitionDependencies } from '../services/_server/recognition-service';
import { RecognitionGate } from '../services/_server/recognition-gate';
import { SystemConfigService } from '../services/_server/system-config/service';
import { startSupplierDraftWorker } from '../services/_server/supplier-drafts/worker';
import type { RequestAuthContext } from '../services/_server/requestAuth';
import { ServiceError } from '../services/_core/error';

const pause = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { resolve, promise };
}

test('batch bounds active work, reports fast results early and retains result order', async () => {
  const first = deferred<number>();
  let active = 0, peak = 0;
  const reported: number[] = [];
  const batch = mapConcurrent([1, 2, 3], 2, async (n) => {
    active++; peak = Math.max(peak, active);
    const result = n === 1 ? await first.promise : n;
    active--; return result;
  }, (value) => reported.push(value));
  await pause();
  assert.deepEqual(reported, [2, 3]);
  first.resolve(1);
  assert.deepEqual(await batch, [1, 2, 3]);
  assert.equal(peak, 2);
});

test('settings validate types, ranges and nested budgets without coercing invalid input', () => {
  for (const input of [{ recognition_concurrency: 0 }, { recognition_concurrency: '2' }, { jpeg_quality: null },
    { unknown: 1 }, { model_timeout_seconds: 90, total_timeout_seconds: 60 }]) {
    assert.throws(() => validateRecognitionSettings(input));
  }
  assert.deepEqual(validateRecognitionSettings({}), defaultRecognitionSettings);
});

test('configuration read and write require admin and enforce validation before storage', async () => {
  let saves = 0;
  const repository = {
    read: async () => ({ values: defaultRecognitionSettings, version: 1, updatedAt: null }),
    save: async () => { saves++; return { values: defaultRecognitionSettings, version: 2, updatedAt: null }; },
  };
  const service = new SystemConfigService(repository as never);
  const user = { permissions: { isAdmin: false } } as RequestAuthContext;
  assert.throws(() => service.read(user), (error: ServiceError) => error.status === 403);
  assert.throws(() => service.save(user, { values: {}, version: 1 }), (error: ServiceError) => error.status === 403);
  const admin = { ...user, permissions: { isAdmin: true } } as RequestAuthContext;
  assert.throws(() => service.save(admin, { values: { max_pdf_pages: 100 }, version: 1 }));
  await service.save(admin, { values: defaultRecognitionSettings, version: 1 });
  assert.equal(saves, 1);
  assert.deepEqual(Object.keys(await service.publicSettings()).sort(), ['interactive_concurrency', 'upload_concurrency']);
});

function recognitionDependencies(overrides: Partial<RecognitionDependencies> = {}) {
  const events: Array<{ event: string; fields: object }> = [];
  let releases = 0;
  const deps: RecognitionDependencies = {
    endpoint: 'http://model.invalid/classify',
    settings: async () => ({ values: defaultRecognitionSettings, version: 3, updatedAt: null }),
    rules: async () => [{ code: 'SOBE' }],
    acquire: async () => async () => { releases++; },
    log: async (event, fields) => { events.push({ event, fields }); },
    fetch: async () => new Response('{"invoice_number":"123"}'),
    ...overrides,
  };
  return { deps, events, releases: () => releases };
}

test('both recognition paths send validated options, propagate trace ID and release admission', async () => {
  const { deps, events, releases } = recognitionDependencies({ fetch: async (_url, request) => {
    const form = request!.body as FormData;
    assert.deepEqual(JSON.parse(form.get('options') as string), defaultRecognitionSettings);
    assert.ok((request!.headers as Record<string, string>)['x-request-id']);
    return new Response('{"invoice_number":"private-invoice"}');
  } });
  await createRecognitionService(deps)(new File(['secret-document'], 'private-filename.pdf'));
  assert.equal(releases(), 1);
  assert.ok(events.some((entry) => entry.event === 'recognition_finished'));
  assert.doesNotMatch(JSON.stringify(events), /private-invoice|secret-document|private-filename/);
});

test('failed upstream releases its lease and preserves actionable page-limit errors', async () => {
  const { deps, releases } = recognitionDependencies({ fetch: async () => new Response('{"detail":"Split this PDF"}', { status: 422 }) });
  await assert.rejects(createRecognitionService(deps)(new File(['x'], 'test.pdf')),
    (error: ServiceError) => error.status === 422 && error.message.includes('Split this PDF'));
  assert.equal(releases(), 1);
});

test('recognition loads settings and rules concurrently before admission', async () => {
  const settings = deferred<Awaited<ReturnType<RecognitionDependencies['settings']>>>();
  const rules = deferred<unknown[]>();
  let settingsStarted = false, rulesStarted = false;
  const { deps } = recognitionDependencies({
    settings: () => { settingsStarted = true; return settings.promise; },
    rules: () => { rulesStarted = true; return rules.promise; },
  });
  const work = createRecognitionService(deps)(new File(['x'], 'test.pdf'));
  await pause();
  assert.equal(settingsStarted, true);
  assert.equal(rulesStarted, true);
  settings.resolve({ values: defaultRecognitionSettings, version: 1, updatedAt: null });
  rules.resolve([{ code: 'SOBE' }]);
  await work;
});

test('recognition gate locks once and combines cleanup with admission', async () => {
  const statements: string[] = [];
  const transaction = async <T>(work: (db: { query: (sql: string) => Promise<{ rows: object[] }> }) => Promise<T>) =>
    work({ query: async (sql) => { statements.push(sql); return { rows: [{ id: 'lease' }] }; } });
  const gate = new RecognitionGate(transaction as never);
  const release = await gate.acquire(1, 30);
  assert.equal(statements.length, 2);
  assert.match(statements[0], /pg_advisory_xact_lock/);
  assert.match(statements[1], /DELETE FROM otto_invoice_recognition_leases/);
  assert.match(statements[1], /INSERT INTO otto_invoice_recognition_leases/);
  await release();
  assert.equal(statements.length, 3);
});

test('supplier worker immediately fills freed slots and honors a lowered limit', async () => {
  const jobs: ReturnType<typeof deferred<boolean>>[] = [];
  let limit = 2;
  const stop = startSupplierDraftWorker(() => {
    const job = deferred<boolean>(); jobs.push(job); return job.promise;
  }, (error) => { throw error; }, async () => limit, 10000);
  try {
    await pause(); assert.equal(jobs.length, 2);
    jobs[0].resolve(true);
    await pause(); assert.equal(jobs.length, 3);
    limit = 1;
    jobs[1].resolve(true);
    await pause(); assert.equal(jobs.length, 3);
    jobs[2].resolve(true);
    await pause(); assert.equal(jobs.length, 4);
  } finally { stop(); jobs.forEach((job) => job.resolve(false)); }
});
