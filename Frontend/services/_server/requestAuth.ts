import { query, queryOne } from '../../lib/db';
import { ServiceError } from '../_core/error';
import { derivePermissionFlags, type PermissionFlags } from '../_core/roles';

interface SessionRow {
  session_id?: string;
  userid?: string;
  expires_at?: string;
  is_active?: boolean;
}

interface UserRoleRow {
  roleid?: string;
}

interface ProjectManagerRow {
  projectid?: string;
}

export interface RequestAuthContext {
  sessionId: string;
  userid: string;
  roleids: string[];
  permissions: PermissionFlags;
}

function toText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeUserId(value: unknown): string {
  return toText(value).toLowerCase();
}

async function hasManagedProject(userid: string): Promise<boolean> {
  const managedProject = await queryOne<ProjectManagerRow>(
    `SELECT projectid
       FROM "otto_project"
      WHERE projectmanager = $1
      LIMIT 1`,
    [userid],
  );

  return Boolean(toText(managedProject?.projectid));
}

async function touchSession(sessionId: string): Promise<void> {
  const nowIso = new Date().toISOString();
  await query(
    `UPDATE "t_loginsessions"
        SET updated_at = $1,
            last_accessed_at = $1
      WHERE session_id = $2`,
    [nowIso, sessionId],
  ).catch(() => undefined);
}

async function expireSession(sessionId: string): Promise<void> {
  const nowIso = new Date().toISOString();
  await query(
    `UPDATE "t_loginsessions"
        SET is_active = false,
            updated_at = $1,
            last_accessed_at = $1
      WHERE session_id = $2`,
    [nowIso, sessionId],
  ).catch(() => undefined);
}

export async function loadAuthContextBySessionId(sessionId: string): Promise<RequestAuthContext> {
  const normalizedSessionId = toText(sessionId);
  if (!normalizedSessionId) {
    throw new ServiceError('Session id missing', { status: 401 });
  }

  const session = await queryOne<SessionRow>(
    `SELECT session_id, userid, expires_at, is_active
       FROM "t_loginsessions"
      WHERE session_id = $1
        AND is_active = true
      LIMIT 1`,
    [normalizedSessionId],
  );

  if (!session?.userid) {
    throw new ServiceError('Session invalid or inactive', { status: 401 });
  }

  const expiresAt = toText(session.expires_at);
  if (expiresAt) {
    const ts = Date.parse(expiresAt);
    if (Number.isFinite(ts) && ts <= Date.now()) {
      await expireSession(normalizedSessionId);
      throw new ServiceError('Session expired', { status: 401 });
    }
  }

  await touchSession(normalizedSessionId);

  const roleRows = await query<UserRoleRow>(
    `SELECT roleid
       FROM "otto_userrole"
      WHERE userid = $1`,
    [session.userid],
  );

  const roleids = Array.from(
    new Set(roleRows.map((row) => toText(row.roleid)).filter(Boolean)),
  );
  const permissions = derivePermissionFlags(roleids);

  if (!permissions.isProjectManager && (await hasManagedProject(toText(session.userid)))) {
    permissions.isProjectManager = true;
  }

  return {
    sessionId: normalizedSessionId,
    userid: toText(session.userid),
    roleids,
    permissions,
  };
}

export async function loadRequestAuthContext(request: Request): Promise<RequestAuthContext> {
  const sessionId = toText(request.headers.get('x-session-id'));
  return loadAuthContextBySessionId(sessionId);
}
