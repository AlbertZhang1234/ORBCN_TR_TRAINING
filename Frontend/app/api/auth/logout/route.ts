import { NextResponse } from 'next/server';
import { query } from '../../../../lib/db';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { session_id?: string };
    const sessionIdFromHeader = request.headers.get('x-session-id')?.trim();
    const sessionIdFromBody = String(body.session_id ?? '').trim();
    const sessionId = sessionIdFromHeader || sessionIdFromBody;
    if (!sessionId) {
      return NextResponse.json({ message: 'Session id is required' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    const result = await query(
      `UPDATE "t_loginsessions" 
       SET "is_active" = false, "updated_at" = $1, "last_accessed_at" = $1 
       WHERE "session_id" = $2 AND "is_active" = true 
       RETURNING session_id`,
      [nowIso, sessionId]
    );

    if (result.length === 0) {
      // Maybe session not found or already inactive, but logout is idempotent-ish
      // However, if session_id is invalid, we might want to say so?
      // Original code returned 500 if update failed, but if it succeeded (even if 0 rows), it returned 200?
      // Actually Supabase update returns rows. If 0 rows, it just returns empty array.
      // But we should return 200 OK regardless to ensure client clears session.
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Logout failed';
    return NextResponse.json({ message }, { status: 500 });
  }
}
