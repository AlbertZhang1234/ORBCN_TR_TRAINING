import { ServiceError } from './error';
import { getClientSessionId } from './session';

export type Primitive = string | number | boolean;
export type EqFilters = Record<string, Primitive | null | undefined>;

export interface SelectOptions {
  select?: string;
  filters?: EqFilters;
  limit?: number;
  orderBy?: {
    column: string;
    ascending?: boolean;
  };
}

interface SupabaseErrorPayload {
  code?: string;
  details?: unknown;
  hint?: unknown;
  message?: string;
}

type ProxyAction = 'select' | 'insert' | 'update' | 'delete';

const ADMIN_PROXY_TABLES = new Set([
  'otto_user',
  'otto_role',
  'otto_userrole',
  'otto_customer',
  'otto_project',
  'otto_travelentry',
  'otto_invoices',
  'otto_tr_h',
  'otto_tr_t',
  't_loginsessions',
]);

function getSupabaseConfig(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new ServiceError(
      'Missing Supabase env. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
  }

  return { url, key };
}

function buildQuery(options: SelectOptions = {}): string {
  const params = new URLSearchParams();
  params.set('select', options.select ?? '*');

  if (options.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      if (value === undefined) {
        continue;
      }
      if (value === null) {
        params.set(key, 'is.null');
      } else {
        params.set(key, `eq.${String(value)}`);
      }
    }
  }

  if (typeof options.limit === 'number') {
    params.set('limit', String(options.limit));
  }

  if (options.orderBy) {
    const dir = options.orderBy.ascending === false ? 'desc' : 'asc';
    params.set('order', `${options.orderBy.column}.${dir}`);
  }

  return params.toString();
}

function buildUrl(table: string, query?: string): string {
  const { url } = getSupabaseConfig();
  const normalizedBase = url.replace(/\/+$/, '');
  const base = `${normalizedBase}/rest/v1/${encodeURIComponent(table)}`;
  return query ? `${base}?${query}` : base;
}

function buildHeaders(extra: HeadersInit = {}): HeadersInit {
  const { key } = getSupabaseConfig();

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function parseError(response: Response): Promise<never> {
  let payload: SupabaseErrorPayload | string | null = null;

  try {
    payload = await response.json();
  } catch {
    payload = await response.text();
  }

  if (payload && typeof payload === 'object') {
    const obj = payload as SupabaseErrorPayload;
    throw new ServiceError(obj.message ?? `Supabase request failed (${response.status})`, {
      status: response.status,
      code: obj.code,
      details: obj.details ?? obj.hint,
    });
  }

  throw new ServiceError(`Supabase request failed (${response.status})`, {
    status: response.status,
    details: payload,
  });
}

async function parseRows<T>(response: Response): Promise<T[]> {
  if (!response.ok) {
    return parseError(response);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    return [];
  }
  return data as T[];
}

async function parseProxyRows<T>(response: Response): Promise<T[]> {
  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = await response.text();
    }

    if (payload && typeof payload === 'object' && 'message' in payload) {
      const proxyPayload = payload as {
        message?: string;
        details?: unknown;
        status?: number;
      };

      let detailedMessage = proxyPayload.message ?? 'Admin proxy request failed';
      let code: string | undefined;
      let details: unknown = payload;

      if (proxyPayload.details && typeof proxyPayload.details === 'object') {
        const inner = proxyPayload.details as {
          code?: unknown;
          message?: unknown;
          details?: unknown;
          hint?: unknown;
        };
        if (typeof inner.message === 'string' && inner.message.trim()) {
          detailedMessage = inner.message;
        }
        if (typeof inner.code === 'string' && inner.code.trim()) {
          code = inner.code;
        }
        details = inner.details ?? inner.hint ?? proxyPayload.details;
      }

      throw new ServiceError(detailedMessage, {
        status: response.status,
        code,
        details,
      });
    }

    throw new ServiceError(`Admin proxy request failed (${response.status})`, {
      status: response.status,
      details: payload,
    });
  }

  const data = await response.json();
  return Array.isArray(data) ? (data as T[]) : [];
}

function shouldUseAdminProxy(table: string): boolean {
  return typeof window !== 'undefined' && ADMIN_PROXY_TABLES.has(table);
}

function assertNoDirectTravelReportViewAccess(table: string): void {
  if (table === 'otto_v_tr_all') {
    throw new ServiceError('Use the Travel Report backend API instead of direct otto_v_tr_all access');
  }
}

async function callAdminProxy<T>(
  table: string,
  action: ProxyAction,
  body: Record<string, unknown> = {},
): Promise<T[]> {
  const sessionId = getClientSessionId();
  const response = await fetch('/api/admin/supabase', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': sessionId,
    },
    body: JSON.stringify({ table, action, ...body }),
  });

  return parseProxyRows<T>(response);
}

export async function selectRows<T = Record<string, unknown>>(
  table: string,
  options: SelectOptions = {},
): Promise<T[]> {
  assertNoDirectTravelReportViewAccess(table);

  if (shouldUseAdminProxy(table)) {
    return callAdminProxy<T>(table, 'select', { options });
  }

  const query = buildQuery(options);
  const response = await fetch(buildUrl(table, query), {
    method: 'GET',
    headers: buildHeaders(),
  });

  return parseRows<T>(response);
}

export async function selectOne<T = Record<string, unknown>>(
  table: string,
  filters: EqFilters,
): Promise<T | null> {
  const rows = await selectRows<T>(table, {
    filters,
    limit: 1,
  });

  return rows[0] ?? null;
}

export async function insertRows<T = Record<string, unknown>>(
  table: string,
  payload: Record<string, unknown> | Array<Record<string, unknown>>,
): Promise<T[]> {
  assertNoDirectTravelReportViewAccess(table);

  if (shouldUseAdminProxy(table)) {
    return callAdminProxy<T>(table, 'insert', { payload });
  }

  const response = await fetch(buildUrl(table), {
    method: 'POST',
    headers: buildHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(payload),
  });

  return parseRows<T>(response);
}

export async function updateRows<T = Record<string, unknown>>(
  table: string,
  filters: EqFilters,
  patch: Record<string, unknown>,
): Promise<T[]> {
  assertNoDirectTravelReportViewAccess(table);

  if (shouldUseAdminProxy(table)) {
    return callAdminProxy<T>(table, 'update', {
      options: { filters },
      patch,
    });
  }

  const query = buildQuery({ filters, select: '*' });
  const response = await fetch(buildUrl(table, query), {
    method: 'PATCH',
    headers: buildHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(patch),
  });

  return parseRows<T>(response);
}

export async function deleteRows<T = Record<string, unknown>>(
  table: string,
  filters: EqFilters,
): Promise<T[]> {
  assertNoDirectTravelReportViewAccess(table);

  if (shouldUseAdminProxy(table)) {
    return callAdminProxy<T>(table, 'delete', {
      options: { filters },
    });
  }

  const query = buildQuery({ filters, select: '*' });
  const response = await fetch(buildUrl(table, query), {
    method: 'DELETE',
    headers: buildHeaders({ Prefer: 'return=representation' }),
  });

  return parseRows<T>(response);
}
