import { SapODataError } from './errors';
import { createResponseError, extractCollection, extractEntity, readPayload } from './response';
import { SapODataSession } from './session';
import {
  type SapODataClientOptions,
  type SapODataCollection,
  type SapODataLogContext,
  type SapODataServiceDefinition,
  type SapQuery,
  type SapRequestOptions,
} from './types';

const DEFAULT_TIMEOUT_MS = 15_000;

function normalizePart(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, '');
}

function buildUrl(
  baseUrl: string,
  serviceRoot: string,
  path: string,
  query?: SapQuery,
): string {
  const base = baseUrl.replace(/\/+$/, '');
  const parts = [base, normalizePart(serviceRoot), normalizePart(path)].filter(Boolean);
  const url = parts.join('/');

  if (!query) {
    return url;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  }

  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}

function isJsonBody(body: unknown): body is Record<string, unknown> {
  return typeof body === 'object' && body !== null && !(body instanceof FormData);
}

function headersToRecord(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

function formatTransportError(error: unknown, url: string): string {
  const cause =
    error && typeof error === 'object' && 'cause' in error
      ? (error as { cause?: { code?: string } }).cause
      : undefined;
  const code = String(cause?.code ?? '').toUpperCase();
  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    // Keep the original URL when it is not a valid absolute URL.
  }

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return `Cannot resolve SAP host ${host}. Check VPN/DNS or SAP_ODATA_BASE_URL.`;
  }
  if (code === 'ECONNREFUSED') {
    return `SAP host ${host} refused the connection. Check the SAP service or network access.`;
  }
  if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') {
    return `Connection to SAP host ${host} timed out. Check VPN, proxy, or network access.`;
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return `Connection to SAP host ${host} timed out. Check VPN, proxy, or network access.`;
  }

  return error instanceof Error ? error.message : String(error);
}

function createAbortSignal(timeoutMs: number, callerSignal?: AbortSignal): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abortCaller = () => controller.abort();

  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort();
    } else {
      callerSignal.addEventListener('abort', abortCaller, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', abortCaller);
    },
  };
}

function resolveNextLink(baseUrl: string, nextLink: string): string {
  try {
    return new URL(nextLink, `${baseUrl}/`).toString();
  } catch {
    return nextLink;
  }
}

export class SapODataClient {
  private readonly baseUrl: string;
  private readonly auth?: SapODataClientOptions['auth'];
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly logger: NonNullable<SapODataClientOptions['logger']>;
  private readonly session = new SapODataSession();
  private readonly csrfRequests = new Map<string, Promise<void>>();

  constructor(options: SapODataClientOptions) {
    if (!options.baseUrl.trim()) {
      throw new SapODataError('SAP OData baseUrl is required', {
        code: 'SAP_ODATA_CONFIGURATION_ERROR',
      });
    }

    this.baseUrl = options.baseUrl.trim().replace(/\/+$/, '');
    this.auth = options.auth;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.logger = options.logger ?? {};
  }

  async request<T>(
    service: SapODataServiceDefinition,
    path: string,
    options: SapRequestOptions = {},
  ): Promise<T> {
    const url = buildUrl(this.baseUrl, service.serviceRoot, path, options.query);
    return this.requestUrl<T>(service, url, options);
  }

  private serviceKey(service: SapODataServiceDefinition): string {
    return `${service.name}:${service.serviceRoot}`;
  }

  private async ensureCsrfToken(
    service: SapODataServiceDefinition,
    options: SapRequestOptions,
  ): Promise<void> {
    const key = this.serviceKey(service);
    if (this.session.getCsrfToken(key)) {
      return;
    }

    const existingRequest = this.csrfRequests.get(key);
    if (existingRequest) {
      return existingRequest;
    }

    const request = this.fetchCsrfToken(service, options);
    this.csrfRequests.set(key, request);
    try {
      await request;
    } finally {
      this.csrfRequests.delete(key);
    }
  }

  private async fetchCsrfToken(
    service: SapODataServiceDefinition,
    options: SapRequestOptions,
  ): Promise<void> {
    const url = buildUrl(this.baseUrl, service.serviceRoot, '');
    const headers = new Headers(options.headers);
    headers.set('X-CSRF-Token', 'Fetch');
    headers.set('Accept', 'application/json');
    headers.set('Cache-Control', 'no-cache');
    headers.set('DataServiceVersion', service.version === 'v2' ? '2.0' : '4.0');
    headers.set('MaxDataServiceVersion', service.version === 'v2' ? '2.0' : '4.0');
    if (this.auth) {
      const authHeaders = await this.auth.getHeaders();
      new Headers(authHeaders).forEach((value, key) => headers.set(key, value));
    }
    const cookieHeader = this.session.getCookieHeader();
    if (cookieHeader && !headers.has('Cookie')) {
      headers.set('Cookie', cookieHeader);
    }

    const { signal, cleanup } = createAbortSignal(
      options.timeoutMs ?? this.timeoutMs,
      options.signal,
    );

    try {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        headers,
        signal,
      });
      this.session.captureResponse(response);
      const payload = await readPayload(response);
      this.logger.debug?.('SAP OData CSRF response received', {
        method: 'GET',
        url,
        service: service.name,
        requestId: options.requestId,
        status: response.status,
        requestHeaders: headersToRecord(headers),
        responseHeaders: headersToRecord(response.headers),
        responseBody: payload,
      });
      if (!response.ok) {
        throw createResponseError(response, payload, options.requestId);
      }

      const token = response.headers.get('x-csrf-token')?.trim();
      if (!token) {
        throw new SapODataError('SAP response did not contain a CSRF token', {
          code: 'SAP_ODATA_CSRF_TOKEN_MISSING',
          requestId: options.requestId,
        });
      }
      this.session.setCsrfToken(this.serviceKey(service), token);
    } catch (error) {
      this.logger.error?.('SAP OData CSRF request exception', {
        method: 'GET',
        url,
        service: service.name,
        requestId: options.requestId,
        requestHeaders: headersToRecord(headers),
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof SapODataError) {
        throw error;
      }
      const message = formatTransportError(error, url);
      throw new SapODataError(`SAP CSRF token request failed: ${message}`, {
        code: 'SAP_ODATA_CSRF_REQUEST_FAILED',
        requestId: options.requestId,
      });
    } finally {
      cleanup();
    }
  }

  async requestUrl<T>(
    service: SapODataServiceDefinition,
    url: string,
    options: SapRequestOptions = {},
  ): Promise<T> {
    const {
      query: _query,
      timeoutMs: requestTimeoutMs,
      requestId,
      body: requestBody,
      csrf: requestCsrfMode,
      ...requestInit
    } = options;
    const method = (requestInit.method ?? 'GET').toUpperCase();
    const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    const csrfMode = requestCsrfMode ?? service.csrf ?? 'auto';
    if (isWrite && csrfMode !== 'disabled') {
      await this.ensureCsrfToken(service, options);
    }
    const startedAt = Date.now();
    const headers = new Headers(requestInit.headers);

    headers.set('Accept', 'application/json');
    headers.set('Cache-Control', 'no-cache');
    headers.set('DataServiceVersion', service.version === 'v2' ? '2.0' : '4.0');
    headers.set('MaxDataServiceVersion', service.version === 'v2' ? '2.0' : '4.0');
    if (this.auth) {
      const authHeaders = await this.auth.getHeaders();
      new Headers(authHeaders).forEach((value, key) => headers.set(key, value));
    }
    if (isWrite && csrfMode !== 'disabled') {
      const csrfToken = this.session.getCsrfToken(this.serviceKey(service));
      if (!csrfToken) {
        throw new SapODataError('SAP CSRF token is unavailable for write request', {
          code: 'SAP_ODATA_CSRF_TOKEN_MISSING',
          requestId,
        });
      }
      headers.set('X-CSRF-Token', csrfToken);
    }
    const cookieHeader = this.session.getCookieHeader();
    if (cookieHeader && !headers.has('Cookie')) {
      headers.set('Cookie', cookieHeader);
    }

    let body: BodyInit | undefined;
    if (isJsonBody(requestBody)) {
      body = JSON.stringify(requestBody);
      headers.set('Content-Type', 'application/json');
    } else {
      body = requestBody;
    }

    const context: SapODataLogContext = {
      method,
      url,
      service: service.name,
      requestId,
      requestHeaders: headersToRecord(headers),
      requestBody,
    };

    const { signal, cleanup } = createAbortSignal(
      requestTimeoutMs ?? this.timeoutMs,
      requestInit.signal,
    );

    this.logger.debug?.('SAP OData request started', context);

    try {
      const response = await this.fetchImpl(url, {
        ...requestInit,
        method,
        headers,
        body,
        signal,
      });
      this.session.captureResponse(response);
      const payload = await readPayload(response);
      context.status = response.status;
      context.durationMs = Date.now() - startedAt;
      context.responseHeaders = headersToRecord(response.headers);
      context.responseBody = payload;
      this.logger.debug?.('SAP OData response received', context);

      if (!response.ok) {
        this.logger.warn?.('SAP OData request failed', context);
        throw createResponseError(response, payload, requestId);
      }

      this.logger.debug?.('SAP OData request completed', context);
      return payload as T;
    } catch (error) {
      context.durationMs = Date.now() - startedAt;
      if (error instanceof SapODataError) {
        throw error;
      }

      const message = formatTransportError(error, url);
      this.logger.error?.('SAP OData request exception', context);
      throw new SapODataError(`SAP OData request failed: ${message}`, {
        code: 'SAP_ODATA_REQUEST_FAILED',
        requestId,
      });
    } finally {
      cleanup();
    }
  }

  async getCollection<T>(
    service: SapODataServiceDefinition,
    entitySet: string,
    query?: SapQuery,
    options: Omit<SapRequestOptions, 'query' | 'method' | 'body'> = {},
  ): Promise<SapODataCollection<T>> {
    const payload = await this.request<unknown>(service, entitySet, {
      ...options,
      method: 'GET',
      query,
    });

    return extractCollection<T>(payload);
  }

  async getCollectionByUrl<T>(
    service: SapODataServiceDefinition,
    nextLink: string,
    options: Omit<SapRequestOptions, 'query' | 'method' | 'body'> = {},
  ): Promise<SapODataCollection<T>> {
    const payload = await this.requestUrl<unknown>(service, resolveNextLink(this.baseUrl, nextLink), {
      ...options,
      method: 'GET',
    });

    return extractCollection<T>(payload);
  }

  async getOne<T>(
    service: SapODataServiceDefinition,
    path: string,
    query?: SapQuery,
    options: Omit<SapRequestOptions, 'query' | 'method' | 'body'> = {},
  ): Promise<T> {
    const payload = await this.request<unknown>(service, path, {
      ...options,
      method: 'GET',
      query,
    });
    return extractEntity(payload) as T;
  }

  async getMetadata(
    service: SapODataServiceDefinition,
    options: Omit<SapRequestOptions, 'method' | 'body' | 'query'> = {},
  ): Promise<string> {
    return this.request<string>(service, '$metadata', {
      ...options,
      method: 'GET',
      headers: {
        Accept: 'application/xml, application/json;q=0.9',
        ...options.headers,
      },
    });
  }

  async post<T>(
    service: SapODataServiceDefinition,
    path: string,
    body: Record<string, unknown>,
    options: Omit<SapRequestOptions, 'method' | 'body'> = {},
  ): Promise<T> {
    const payload = await this.request<unknown>(service, path, {
      ...options,
      method: 'POST',
      body,
    });
    return extractEntity(payload) as T;
  }
}

export function createSapODataClient(options: SapODataClientOptions): SapODataClient {
  return new SapODataClient(options);
}
