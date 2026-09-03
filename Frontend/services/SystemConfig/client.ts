import { getClientSessionId } from '../_core/session';
import { ServiceError } from '../_core/error';
import type { RecognitionSettings, SystemConfigSnapshot } from './model';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store', headers: {
    'x-session-id': getClientSessionId(), ...init?.headers,
  } });
  const body = await response.json();
  if (!response.ok) throw new ServiceError(body.message || 'Unable to load system configuration', { status: response.status });
  return body;
}
export const loadSystemConfig = () => request<SystemConfigSnapshot>('/api/admin/system-config');
export const saveSystemConfig = (values: RecognitionSettings, version: number) => request<SystemConfigSnapshot>('/api/admin/system-config', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values, version }),
});
export const loadInvoiceBatchSettings = () => request<Pick<RecognitionSettings, 'upload_concurrency' | 'interactive_concurrency'>>('/api/invoice/settings');
