import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { derivePermissionFlags } from '../../../../services/_core/roles';
import { query, queryOne } from '../../../../lib/db';

interface UserRow {
  userid: string;
  email?: string;
  firstname?: string;
  lastname?: string;
  password?: string;
}

interface UserRoleRow {
  roleid?: string;
}

interface LoginSessionRow {
  session_id?: string;
}

function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

function resolveClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }
  return request.headers.get('x-real-ip')?.trim() || '';
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { account?: string; password?: string };
    const account = String(body.account ?? '').trim();
    const password = String(body.password ?? '');

    if (!account) {
      return NextResponse.json({ message: 'Account is required' }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ message: 'Password is required' }, { status: 400 });
    }

    const normalizedAccount = account.toLowerCase();
    const user = await queryOne<UserRow>(
      `SELECT userid, email, firstname, lastname, password FROM "otto_user" WHERE "userid" = $1 OR "email" = $1 OR "email" = $2 LIMIT 1`,
      [account, normalizedAccount]
    );

    if (!user) {
      return NextResponse.json({ message: 'Account not found' }, { status: 404 });
    }

    const stored = String(user.password ?? '');
    let valid = false;
    let shouldUpgradeLegacyPassword = false;

    if (isBcryptHash(stored)) {
      valid = await bcrypt.compare(password, stored);
    } else {
      valid = stored === password;
      shouldUpgradeLegacyPassword = valid;
    }

    if (!valid) {
      return NextResponse.json({ message: 'Invalid password' }, { status: 401 });
    }

    if (shouldUpgradeLegacyPassword) {
      const upgradedHash = await bcrypt.hash(password, 10);
      await query(
        'UPDATE "otto_user" SET "password" = $1 WHERE "userid" = $2',
        [upgradedHash, user.userid],
      ).catch(() => undefined);
    }

    // Login successful, create session
    const ip = resolveClientIp(request);
    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h
    const sessionId = crypto.randomUUID();

    // Insert session directly using PG
    const session = await queryOne<LoginSessionRow>(
      `INSERT INTO "t_loginsessions" (
        "session_id", "userid", "expires_at", "created_at", "updated_at", "last_accessed_at", "ip_address", "is_active", "device_id"
      ) VALUES ($1, $2, $3, $4, $4, $4, $5, true, $6) RETURNING session_id`,
      [
        sessionId,
        user.userid,
        expires.toISOString(),
        now.toISOString(),
        ip,
        JSON.stringify({
          userAgent: request.headers.get('user-agent'),
        }),
      ]
    );

    if (!session?.session_id) {
      return NextResponse.json({ message: 'Failed to create session' }, { status: 500 });
    }

    // Get roles
    const roles = await import('../../../../lib/db').then(m => m.query<UserRoleRow>(
      `SELECT "roleid" FROM "otto_userrole" WHERE "userid" = $1`,
      [user.userid]
    ));
    
    const roleids = roles.map(r => r.roleid || '');
    const permissions = derivePermissionFlags(roleids);

    // Check project manager status if not already PM
    if (!permissions.isProjectManager) {
        const pmProjects = await import('../../../../lib/db').then(m => m.query(
            `SELECT "projectid" FROM "otto_project" WHERE "projectmanager" = $1 LIMIT 1`,
            [user.userid]
        ));
        if (pmProjects.length > 0) {
            permissions.isProjectManager = true;
        }
    }

    return NextResponse.json(
      {
        userid: user.userid,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        roleids,
        permissions,
        session_id: session.session_id,
        expires_at: expires.toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Login error:', error);
    const message = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json({ message }, { status: 500 });
  }
}
