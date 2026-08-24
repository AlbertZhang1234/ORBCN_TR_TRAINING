import { ServiceError } from '../_core/error';

export interface LoginUser {
  userid: string;
  email?: string;
  firstname?: string;
  lastname?: string;
  roleids?: string[];
  permissions?: {
    isAdmin: boolean;
    isFinance: boolean;
    isProjectManager: boolean;
  };
  session_id?: string;
  expires_at?: string;
}

export async function loginByUserIdOrEmail(
  account: string,
  password: string,
): Promise<LoginUser> {
  const normalized = account.trim();
  if (!normalized) {
    throw new ServiceError('Account is required');
  }
  if (!password) {
    throw new ServiceError('Password is required');
  }

  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account: normalized,
      password,
    }),
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message?: string }).message ?? 'Login failed')
        : 'Login failed';
    throw new ServiceError(message);
  }

  return payload as LoginUser;
}
