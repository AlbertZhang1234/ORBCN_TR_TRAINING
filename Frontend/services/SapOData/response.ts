import { SapODataError } from './errors';
import type { SapODataCollection } from './types';

export async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getPayloadMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const message = (error as { message?: unknown }).message;
  if (typeof message === 'string') {
    return message;
  }
  if (message && typeof message === 'object') {
    const value = (message as { value?: unknown }).value;
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

function getPayloadCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && code.trim() ? code : undefined;
}

function summarizeRawPayload(payload: string): string | undefined {
  const text = payload.replace(/\s+/g, ' ').trim();
  if (!text) {
    return undefined;
  }

  const xmlMessage = text.match(/<(?:message|errordetail|value)[^>]*>([^<]+)</i)?.[1];
  return (xmlMessage ?? text).slice(0, 500);
}

export function createResponseError(
  response: Response,
  payload: unknown,
  requestId?: string,
): SapODataError {
  const message =
    getPayloadMessage(payload) ??
    (typeof payload === 'string'
      ? summarizeRawPayload(payload) ?? `SAP OData request failed (${response.status})`
      : `SAP OData request failed (${response.status})`);
  return new SapODataError(message, {
    status: response.status,
    code: getPayloadCode(payload),
    details: payload,
    requestId,
    rawText: typeof payload === 'string' ? payload : null,
  });
}

export function extractEntity(payload: unknown): unknown {
  if (payload && typeof payload === 'object' && 'd' in payload) {
    return (payload as { d: unknown }).d;
  }
  return payload;
}

export function extractCollection<T>(payload: unknown): SapODataCollection<T> {
  const entity = extractEntity(payload);
  if (Array.isArray(entity)) {
    return { items: entity as T[] };
  }

  if (!entity || typeof entity !== 'object') {
    throw new SapODataError('SAP OData collection response is invalid', {
      code: 'SAP_ODATA_INVALID_RESPONSE',
    });
  }

  const value = (entity as { value?: unknown }).value;
  const results = (entity as { results?: unknown }).results;
  const items = Array.isArray(value) ? value : Array.isArray(results) ? results : undefined;
  if (!items) {
    throw new SapODataError('SAP OData collection response has no value array', {
      code: 'SAP_ODATA_INVALID_RESPONSE',
    });
  }

  const typedEntity = entity as {
    '@odata.nextLink'?: unknown;
    '@odata.count'?: unknown;
    __next?: unknown;
    __count?: unknown;
  };
  const nextLink =
    typeof typedEntity['@odata.nextLink'] === 'string'
      ? typedEntity['@odata.nextLink']
      : typeof typedEntity.__next === 'string'
        ? typedEntity.__next
        : undefined;
  const rawCount = typedEntity['@odata.count'] ?? typedEntity.__count;
  const count = Number.isFinite(Number(rawCount)) ? Number(rawCount) : undefined;

  return { items: items as T[], nextLink, count };
}
