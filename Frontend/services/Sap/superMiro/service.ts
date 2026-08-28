import { createSapODataClientFromEnv } from '../../_server/sapODataDependencies';
import type { SapODataCollection, SapQuery, SapRequestOptions } from '../../SapOData';
import type { SuperMiroEInvoiceSapRecord } from './sapTypes';
import { mapSuperMiroEInvoice } from './mapper';
import { SUPER_MIRO_RESOURCE } from './resource';
import type {
  CreateSuperMiroEInvoicePayload,
  ListSuperMiroEInvoicesInput,
  SuperMiroEInvoice,
  SuperMiroEInvoicesResult,
} from './types';

function escapeODataString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function positiveInteger(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(0, Math.trunc(value));
}

function buildFilter(input: ListSuperMiroEInvoicesInput): string | undefined {
  const filters: string[] = [];
  const fields: Array<[keyof ListSuperMiroEInvoicesInput, string]> = [
    ['code', 'Code'],
    ['vatno', 'Vatno'],
    ['seqno', 'Seqno'],
    ['bukrs', 'Bukrs'],
    ['lifnr', 'Lifnr'],
    ['pono', 'Pono'],
    ['belnr', 'Belnr'],
    ['gjahr', 'Gjahr'],
    ['gtstat', 'Gtstat'],
  ];

  for (const [inputName, sapName] of fields) {
    const value = input[inputName];
    if (typeof value === 'string' && value.trim()) {
      filters.push(`${sapName} eq ${escapeODataString(value.trim())}`);
    }
  }

  return filters.length > 0 ? filters.join(' and ') : undefined;
}

function buildQuery(input: ListSuperMiroEInvoicesInput): SapQuery {
  const query: SapQuery = {};
  if (input.select?.length) {
    query['$select'] = input.select.join(',');
  }
  const filter = buildFilter(input);
  if (filter) {
    query['$filter'] = filter;
  }
  const top = positiveInteger(input.top);
  const skip = positiveInteger(input.skip);
  if (top !== undefined) {
    query['$top'] = top;
  }
  if (skip !== undefined) {
    query['$skip'] = skip;
  }
  if (input.count) {
    query['$inlinecount'] = 'allpages';
  }
  return query;
}

function mapResult(
  result: SapODataCollection<SuperMiroEInvoiceSapRecord>,
): SuperMiroEInvoicesResult {
  return {
    items: result.items.map(mapSuperMiroEInvoice),
    nextLink: result.nextLink,
    count: result.count,
  };
}

export async function listSuperMiroEInvoices(
  input: ListSuperMiroEInvoicesInput = {},
  requestOptions?: Omit<SapRequestOptions, 'query' | 'method' | 'body'>,
): Promise<SuperMiroEInvoicesResult> {
  const client = createSapODataClientFromEnv();
  const result = await client.getCollection<SuperMiroEInvoiceSapRecord>(
    SUPER_MIRO_RESOURCE,
    SUPER_MIRO_RESOURCE.entitySet,
    buildQuery(input),
    requestOptions,
  );
  return mapResult(result);
}

export async function listNextSuperMiroEInvoices(
  nextLink: string,
  requestOptions?: Omit<SapRequestOptions, 'query' | 'method' | 'body'>,
): Promise<SuperMiroEInvoicesResult> {
  const client = createSapODataClientFromEnv();
  const result = await client.getCollectionByUrl<SuperMiroEInvoiceSapRecord>(
    SUPER_MIRO_RESOURCE,
    nextLink,
    requestOptions,
  );
  return mapResult(result);
}

export async function createSuperMiroEInvoice(
  payload: CreateSuperMiroEInvoicePayload,
): Promise<SuperMiroEInvoice | null> {
  const client = createSapODataClientFromEnv();
  const record = await client.post<SuperMiroEInvoiceSapRecord>(
    SUPER_MIRO_RESOURCE,
    SUPER_MIRO_RESOURCE.entitySet,
    payload,
  );
  return record ? mapSuperMiroEInvoice(record) : null;
}

export function createSuperMiroEInvoiceWriter(): (
  payload: CreateSuperMiroEInvoicePayload,
) => Promise<SuperMiroEInvoice | null> {
  const client = createSapODataClientFromEnv();
  return async (payload) => {
    const record = await client.post<SuperMiroEInvoiceSapRecord>(
      SUPER_MIRO_RESOURCE,
      SUPER_MIRO_RESOURCE.entitySet,
      payload,
    );
    return record ? mapSuperMiroEInvoice(record) : null;
  };
}
