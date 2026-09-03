import { randomUUID } from 'node:crypto';
import type { InvoiceParseResult } from '../Invoice/parse';
import type { SystemConfigSnapshot } from '../SystemConfig/model';
import { ServiceError } from '../_core/error';
import type { InvoiceLog } from './invoice-log';

export interface RecognitionDependencies {
  endpoint: string;
  settings: () => Promise<SystemConfigSnapshot>;
  rules: () => Promise<unknown[]>;
  acquire: (waitSeconds: number, leaseSeconds: number) => Promise<() => Promise<void>>;
  log: InvoiceLog;
  fetch: typeof fetch;
}
export function createRecognitionService(deps: RecognitionDependencies) {
  return async (file: File): Promise<InvoiceParseResult> => {
    const requestId = randomUUID();
    const started = Date.now();
    let release: (() => Promise<void>) | undefined;
    let status = 'error';
    try {
      const { values, version } = await deps.settings();
      const settingsLoaded = Date.now();
      const rules = await deps.rules();
      if (!rules.length) throw new ServiceError('No active booking rules configured', { status: 503 });
      const waiting = Date.now();
      release = await deps.acquire(values.queue_timeout_seconds, values.total_timeout_seconds + 60);
      await deps.log('recognition_admitted', { request_id: requestId, queue_ms: Date.now() - waiting,
        config_ms: settingsLoaded - started, rules_ms: waiting - settingsLoaded, config_version: version, bytes: file.size });
      const form = new FormData();
      form.append('file', file, file.name);
      form.append('booking_rules', JSON.stringify(rules));
      form.append('options', JSON.stringify(values));
      const response = await deps.fetch(deps.endpoint, { method: 'POST', body: form,
        headers: { 'x-request-id': requestId }, signal: AbortSignal.timeout((values.total_timeout_seconds + 10) * 1000) });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const detail = typeof body.detail === 'string' ? body.detail : 'Invoice recognition failed';
        throw new ServiceError(`${detail} (${requestId})`, { status: [400, 413, 422, 504].includes(response.status) ? response.status : 502 });
      }
      const result = await response.json() as InvoiceParseResult;
      status = result.fallback_used ? 'fallback' : 'success';
      return result;
    } catch (error) {
      await deps.log('recognition_error', { request_id: requestId,
        error_type: error instanceof ServiceError ? error.code ?? `http_${error.status}` : error instanceof Error ? error.name : 'unknown' });
      if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name))
        throw new ServiceError(`识别超时，请稍后重试 / Recognition timed out (${requestId})`, { status: 504 });
      throw error;
    } finally {
      await release?.().catch(() => deps.log('lease_release_failed', { request_id: requestId }));
      await deps.log('recognition_finished', { request_id: requestId, status, total_ms: Date.now() - started });
    }
  };
}
