import type { SapAuthProvider } from './types';

export function createBasicAuthProvider(
  username: string,
  password: string,
): SapAuthProvider {
  const encoded = Buffer.from(`${username}:${password}`).toString('base64');

  return {
    async getHeaders(): Promise<HeadersInit> {
      return { Authorization: `Basic ${encoded}` };
    },
  };
}

export function createBearerAuthProvider(
  getToken: () => Promise<string>,
): SapAuthProvider {
  return {
    async getHeaders(): Promise<HeadersInit> {
      const token = (await getToken()).trim();
      if (!token) {
        throw new Error('SAP bearer token is empty');
      }
      return { Authorization: `Bearer ${token}` };
    },
  };
}
