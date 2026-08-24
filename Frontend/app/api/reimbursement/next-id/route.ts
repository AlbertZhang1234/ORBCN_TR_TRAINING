import { NextResponse } from 'next/server';
import { query } from '../../../../lib/db';

interface SessionRow {
  session_id?: string;
  is_active?: boolean;
  expires_at?: string;
}

interface MaxIdRow {
  max_id?: number | string | null;
}

function normalizeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return 0;
}

async function isSessionValid(sessionId: string): Promise<boolean> {
  const rows = await query<SessionRow>(
    'SELECT session_id, is_active, expires_at FROM "t_loginsessions" WHERE session_id = $1 AND is_active = true LIMIT 1',
    [sessionId],
  );
  const session = rows[0];
  if (!session?.session_id || session.is_active !== true) {
    return false;
  }
  const expiresAt = String(session.expires_at ?? '').trim();
  if (!expiresAt) {
    return true;
  }
  const expiresTs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresTs)) {
    return true;
  }
  return expiresTs > Date.now();
}

export async function GET(request: Request) {
  try {
    const sessionId = request.headers.get('x-session-id')?.trim();
    if (!sessionId) {
      return NextResponse.json({ message: 'Session id missing' }, { status: 401 });
    }

    const valid = await isSessionValid(sessionId);
    if (!valid) {
      return NextResponse.json({ message: 'Session invalid or expired' }, { status: 401 });
    }

    const rows = await query<MaxIdRow>('SELECT COALESCE(MAX(id), 0) AS max_id FROM "otto_tr_h"');
    const maxId = normalizeNumber(rows[0]?.max_id);
    const nextId = maxId + 1;

    return NextResponse.json({ maxId, nextId }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to calculate next reimbursement id';
    return NextResponse.json({ message }, { status: 500 });
  }
}

