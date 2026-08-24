import { ServiceError } from './error';

const SESSION_KEY = 'pc_session_user';

interface StoredSession {
  session_id?: unknown;
}

function readRawBrowserSession(): string {
  if (typeof window === 'undefined') {
    throw new ServiceError('No browser session available');
  }

  const raw = window.sessionStorage.getItem(SESSION_KEY);
  if (!raw) {
    throw new ServiceError('Session expired. Please login again.');
  }

  return raw;
}

export function getClientSessionId(): string {
  const raw = readRawBrowserSession();

  let parsed: StoredSession | null = null;
  try {
    parsed = JSON.parse(raw) as StoredSession;
  } catch {
    parsed = null;
  }

  const sessionId = String(parsed?.session_id ?? '').trim();
  if (!sessionId) {
    throw new ServiceError('Session id missing. Please login again.');
  }

  return sessionId;
}
