'use client';

import { clearSessionUser, getSessionId } from '../../app/pc/_components/session';

interface RouterLike {
  push: (href: string) => void;
  replace?: (href: string) => void;
}

interface LogoutOptions {
  router?: RouterLike;
  redirectTo?: string;
  replace?: boolean;
}

export async function performClientLogout(options: LogoutOptions = {}): Promise<void> {
  const redirectTo = options.redirectTo ?? '/pc/login';
  const sessionId = getSessionId();

  if (sessionId) {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId,
      },
      body: JSON.stringify({ session_id: sessionId }),
    }).catch(() => undefined);
  }

  clearSessionUser();

  const router = options.router;
  if (router) {
    if (options.replace && router.replace) {
      router.replace(redirectTo);
      return;
    }
    router.push(redirectTo);
    return;
  }

  if (typeof window !== 'undefined') {
    window.location.href = redirectTo;
  }
}
