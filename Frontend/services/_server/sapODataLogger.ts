import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SapODataLogContext, SapODataLogger } from '../SapOData/types';

const REDACTED = '[REDACTED]';
const MAX_BODY_LENGTH = 20_000;

function redactHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  if (!headers) return {};
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      const name = key.toLowerCase();
      const redact = name === 'authorization' || name === 'cookie' || name === 'set-cookie' || name === 'x-csrf-token';
      return [key, redact ? REDACTED : value];
    }),
  );
}

function serializeBody(body: unknown): unknown {
  if (body === undefined) return undefined;
  if (typeof body === 'string') return body.length > MAX_BODY_LENGTH ? `${body.slice(0, MAX_BODY_LENGTH)}...[truncated]` : body;
  try {
    const serialized = JSON.stringify(body);
    return serialized.length <= MAX_BODY_LENGTH ? body : `${serialized.slice(0, MAX_BODY_LENGTH)}...[truncated]`;
  } catch {
    return '[unserializable]';
  }
}

function writeLog(message: string, context?: SapODataLogContext): void {
  const directory = process.env.SAP_ODATA_LOG_DIR?.trim() || join(process.cwd(), 'log', 'sap-odata');
  const fileName = `${new Date().toISOString().slice(0, 10)}.jsonl`;
  const record = {
    timestamp: new Date().toISOString(),
    message,
    ...(context ?? {}),
    requestHeaders: redactHeaders(context?.requestHeaders),
    responseHeaders: redactHeaders(context?.responseHeaders),
    requestBody: serializeBody(context?.requestBody),
    responseBody: serializeBody(context?.responseBody),
  };
  try {
    mkdirSync(directory, { recursive: true });
    appendFileSync(join(directory, fileName), `${JSON.stringify(record)}\n`, 'utf8');
  } catch (error) {
    console.error('Failed to write SAP OData log', error);
  }
}

export function createSapODataFileLogger(): SapODataLogger {
  return { debug: writeLog, info: writeLog, warn: writeLog, error: writeLog };
}
