import { query } from '../../lib/db';
import { ServiceError } from '../_core/error';
import type { RequestAuthContext } from '../_server/requestAuth';
import { normalizeTravelReportRow, type TravelReportRow } from './_shared';

export interface TravelReportAccessContext {
  requesterUserId: string;
  requestUserId: string;
  roleids: string[];
  permissions: RequestAuthContext['permissions'];
  canViewAll: boolean;
}

interface TravelReportListOptions {
  limit?: number;
}

const OWNER_COLUMNS = ['tr_userid', 'invoice_userid'] as const;

function toText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeUserId(value: unknown): string {
  return toText(value).toLowerCase();
}

function pushParam(params: unknown[], value: unknown): string {
  params.push(value);
  return `$${params.length}`;
}

export function resolveTravelReportAccess(
  auth: RequestAuthContext,
  requestUserId: string,
): TravelReportAccessContext {
  const normalizedRequestUserId = normalizeUserId(requestUserId);
  if (!normalizedRequestUserId) {
    throw new ServiceError('requestUserId is required', { status: 400 });
  }

  const canViewAll = auth.permissions.isAdmin || auth.permissions.isFinance;
  if (!canViewAll && normalizedRequestUserId !== normalizeUserId(auth.userid)) {
    throw new ServiceError('Only finance or admin can query other users', { status: 403 });
  }

  return {
    requesterUserId: normalizeUserId(auth.userid),
    requestUserId: normalizedRequestUserId,
    roleids: auth.roleids,
    permissions: auth.permissions,
    canViewAll,
  };
}

export function buildTravelReportOwnerClause(params: unknown[], requestUserId: string): string {
  const userParam = pushParam(params, normalizeUserId(requestUserId));
  return `(${OWNER_COLUMNS.map((column) => `LOWER(COALESCE("${column}", '')) = ${userParam}`).join(' OR ')})`;
}

export function buildTravelReportVisibilityClause(
  params: unknown[],
  access: TravelReportAccessContext,
): string {
  if (access.canViewAll) {
    return 'TRUE';
  }

  return buildTravelReportOwnerClause(params, access.requestUserId);
}

export async function listTravelReportRowsForAccess(
  access: TravelReportAccessContext,
  options: TravelReportListOptions = {},
): Promise<TravelReportRow[]> {
  const params: unknown[] = [];
  const whereClause = buildTravelReportVisibilityClause(params, access);
  let sql = `SELECT * FROM "otto_v_tr_all" WHERE ${whereClause} ORDER BY "tr_id" DESC`;

  if (typeof options.limit === 'number' && options.limit > 0) {
    sql += ` LIMIT ${Math.trunc(options.limit)}`;
  }

  const rows = await query<TravelReportRow>(sql, params);
  return rows.map(normalizeTravelReportRow);
}
