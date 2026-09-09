import assert from 'node:assert/strict';
import test from 'node:test';
import { ServiceError } from '../services/_core/error';
import { startSupplierDraftWorker } from '../services/_server/supplier-drafts/worker';
import { SystemConfigRepository } from '../services/_server/system-config/repository';

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('missing system configuration has a stable fatal error code', async () => {
  const missingTable = new SystemConfigRepository(async () => { throw Object.assign(new Error('missing'), { code: '42P01' }); });
  await assert.rejects(missingTable.read(),
    (error: ServiceError) => error.status === 503 && error.code === 'SYSTEM_CONFIG_MISSING');
  const missingRow = new SystemConfigRepository(async () => []);
  await assert.rejects(missingRow.read(),
    (error: ServiceError) => error.status === 503 && error.code === 'SYSTEM_CONFIG_MISSING');
});

test('supplier worker reports a missing configuration once and then stops polling', async () => {
  let configurationReads = 0;
  let runs = 0;
  const reports: unknown[] = [];
  const stop = startSupplierDraftWorker(async () => { runs += 1; return false; },
    (error) => reports.push(error), async () => {
      configurationReads += 1;
      throw new ServiceError('migration required', { status: 503, code: 'SYSTEM_CONFIG_MISSING' });
    }, 5);
  await pause(35);
  stop();
  assert.equal(configurationReads, 1);
  assert.equal(reports.length, 1);
  assert.equal(runs, 0);
});

test('supplier worker still retries transient configuration database errors', async () => {
  let configurationReads = 0;
  let releaseRetry!: () => void;
  const retried = new Promise<void>((resolve) => { releaseRetry = resolve; });
  const stop = startSupplierDraftWorker(async () => false, () => undefined, async () => {
    configurationReads += 1;
    if (configurationReads === 1) throw new Error('temporary database outage');
    releaseRetry();
    return 0;
  }, 5);
  await retried;
  stop();
  assert.ok(configurationReads >= 2);
});
