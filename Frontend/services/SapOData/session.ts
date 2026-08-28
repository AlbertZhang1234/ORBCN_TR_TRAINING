function parseCookie(setCookie: string): [string, string] | undefined {
  const pair = setCookie.split(';', 1)[0]?.trim();
  const separator = pair?.indexOf('=') ?? -1;
  if (!pair || separator <= 0) {
    return undefined;
  }
  return [pair.slice(0, separator).trim(), pair.slice(separator + 1).trim()];
}

function readSetCookieHeaders(headers: Headers): string[] {
  const nodeHeaders = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof nodeHeaders.getSetCookie === 'function') {
    return nodeHeaders.getSetCookie();
  }

  const value = headers.get('set-cookie');
  return value ? [value] : [];
}

export class SapODataSession {
  private readonly cookies = new Map<string, string>();
  private readonly csrfTokens = new Map<string, string>();

  getCookieHeader(): string | undefined {
    if (this.cookies.size === 0) {
      return undefined;
    }
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  captureResponse(response: Response): void {
    for (const setCookie of readSetCookieHeaders(response.headers)) {
      const cookie = parseCookie(setCookie);
      if (cookie) {
        this.cookies.set(cookie[0], cookie[1]);
      }
    }
  }

  getCsrfToken(serviceKey: string): string | undefined {
    return this.csrfTokens.get(serviceKey);
  }

  setCsrfToken(serviceKey: string, token: string): void {
    this.csrfTokens.set(serviceKey, token);
  }

  clearCsrfToken(serviceKey: string): void {
    this.csrfTokens.delete(serviceKey);
  }
}
