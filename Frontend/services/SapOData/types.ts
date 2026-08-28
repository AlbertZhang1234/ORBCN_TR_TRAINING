export type SapODataVersion = 'v2' | 'v4';
export type SapCsrfMode = 'auto' | 'required' | 'disabled';

export interface SapODataServiceDefinition {
  name: string;
  serviceRoot: string;
  version?: SapODataVersion;
  csrf?: SapCsrfMode;
}

export type SapQueryValue = string | number | boolean | null | undefined;
export type SapQuery = Record<string, SapQueryValue>;

export interface SapAuthProvider {
  getHeaders(): Promise<HeadersInit>;
}

export interface SapODataLogContext {
  method: string;
  url: string;
  service: string;
  status?: number;
  durationMs?: number;
  requestId?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: unknown;
  responseHeaders?: Record<string, string>;
  responseBody?: unknown;
  errorMessage?: string;
}

export interface SapODataLogger {
  debug?(message: string, context?: SapODataLogContext): void;
  info?(message: string, context?: SapODataLogContext): void;
  warn?(message: string, context?: SapODataLogContext): void;
  error?(message: string, context?: SapODataLogContext): void;
}

export interface SapODataClientOptions {
  baseUrl: string;
  auth?: SapAuthProvider;
  fetch?: typeof fetch;
  timeoutMs?: number;
  logger?: SapODataLogger;
}

export interface SapRequestOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | Record<string, unknown>;
  query?: SapQuery;
  timeoutMs?: number;
  requestId?: string;
  csrf?: SapCsrfMode;
}

export interface SapODataCollection<T> {
  items: T[];
  nextLink?: string;
  count?: number;
}
