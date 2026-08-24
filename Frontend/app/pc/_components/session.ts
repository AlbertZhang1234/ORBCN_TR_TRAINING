'use client';

export interface SessionUser {
  userid: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  roleids?: string[];
  permissions?: {
    isAdmin: boolean;
    isFinance: boolean;
    isProjectManager: boolean;
  };
  session_id?: string;
  expires_at?: string;
}

const SESSION_KEY = 'pc_session_user';

export function getSessionUser(): SessionUser | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as SessionUser;
    const sessionId = String(parsed.session_id ?? '').trim();
    if (!sessionId) {
      window.sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    const expiresAt = String(parsed.expires_at ?? '').trim();
    if (expiresAt) {
      const ts = Date.parse(expiresAt);
      if (Number.isFinite(ts) && ts <= Date.now()) {
        window.sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
    }

    return {
      ...parsed,
      session_id: sessionId,
    };
  } catch {
    return null;
  }
}

export function setSessionUser(user: SessionUser): void {
  if (typeof window === 'undefined') {
    return;
  }

  const sessionId = String(user.session_id ?? '').trim();
  window.sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      ...user,
      session_id: sessionId || undefined,
    }),
  );
}

export function clearSessionUser(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(SESSION_KEY);
}

export function getSessionId(): string | null {
  const user = getSessionUser();
  const sessionId = String(user?.session_id ?? '').trim();
  return sessionId || null;
}
