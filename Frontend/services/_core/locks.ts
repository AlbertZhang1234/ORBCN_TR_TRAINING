import { ServiceError } from './error';

const SUBMITTED_VALUES = new Set(['submitted', '已提交']);
const BOOKED_VALUES = new Set([
  'booked',
  'posted',
  'accounted',
  'closed',
  'locked',
  '已记账',
  '已入账',
  '已回传sap系统',
]);

export function isSapPostedStatus(value: unknown): boolean {
  return normalizeStatus(value) === '已回传sap系统';
}

export const STATUS_CANDIDATES = [
  'bookingstatus',
  'booking_status',
  'financestatus',
  'finance_status',
  'status',
];

const APPROVAL_CANDIDATES = ['approvalstatus', 'approval_status'];
const BY_CANDIDATES = ['bookedby', 'booked_by', 'financeby', 'finance_by'];
const AT_CANDIDATES = ['bookedat', 'booked_at', 'financeat', 'finance_at'];

function normalizeStatus(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function normalizeWorkflowStatus(
  value: unknown,
): 'PENDING' | 'WAIT FOR APPROVAL' | 'SUBMITTED' | 'BOOKED' | 'APPROVED' | 'REJECTED' {
  const normalized = normalizeStatus(value);
  if (!normalized || normalized === 'open' || normalized === 'pending' || normalized === '待报销') {
    return 'PENDING';
  }
  if (
    normalized === 'wait for approval' ||
    normalized === 'waiting for approval' ||
    normalized === 'waitforapproval' ||
    normalized === '待审批'
  ) {
    return 'WAIT FOR APPROVAL';
  }
  if (normalized === 'submitted' || normalized === '已提交') {
    return 'SUBMITTED';
  }
  if (BOOKED_VALUES.has(normalized)) {
    return 'BOOKED';
  }
  if (normalized === 'approved' || normalized === '已审批') {
    return 'APPROVED';
  }
  if (normalized === 'rejected' || normalized === '已拒绝') {
    return 'REJECTED';
  }
  return 'PENDING';
}

export function isSubmittedStatus(value: unknown): boolean {
  return SUBMITTED_VALUES.has(normalizeStatus(value));
}

export function isBookedStatus(value: unknown): boolean {
  return BOOKED_VALUES.has(normalizeStatus(value));
}

export function readFirstExisting(
  row: Record<string, unknown>,
  keys: string[],
): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return row[key];
    }
  }
  return undefined;
}

export function ensureRecordMutable(
  row: Record<string, unknown>,
  entityLabel: string,
): void {
  const bookingValue = readFirstExisting(row, STATUS_CANDIDATES);
  const approvalValue = readFirstExisting(row, APPROVAL_CANDIDATES);

  if (isBookedStatus(bookingValue) || isBookedStatus(approvalValue)) {
    throw new ServiceError(`${entityLabel} is already booked/locked and cannot be changed`);
  }
}

export function buildStatusPatch(
  row: Record<string, unknown>,
  nextStatus: 'open' | 'submitted' | 'booked' | 'approved' | 'rejected',
  actor?: string,
  atIso?: string,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const normalizedStatus = normalizeWorkflowStatus(nextStatus);

  for (const key of STATUS_CANDIDATES) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      patch[key] = normalizedStatus;
      break;
    }
  }

  /*
  if (actor) {
    for (const key of BY_CANDIDATES) {
      if (Object.prototype.hasOwnProperty.call(row, key)) {
        patch[key] = actor;
        break;
      }
    }
  }

  if (atIso) {
    for (const key of AT_CANDIDATES) {
      if (Object.prototype.hasOwnProperty.call(row, key)) {
        patch[key] = atIso;
        break;
      }
    }
  }
  */

  return patch;
}
