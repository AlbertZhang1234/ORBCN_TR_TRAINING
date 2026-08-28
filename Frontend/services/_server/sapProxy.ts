import { execFileSync } from 'node:child_process';
import { ProxyAgent } from 'undici';

const INTERNET_SETTINGS_KEY =
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';

function normalizeProxyUrl(value: unknown): string | undefined {
  const text = String(value ?? '').trim();
  if (!text || text.toLowerCase() === 'none') {
    return undefined;
  }

  try {
    const url = new URL(text.includes('://') ? text : `http://${text}`);
    if (!url.hostname || !url.port) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function readWindowsProxy(): string | undefined {
  if (process.platform !== 'win32') {
    return undefined;
  }

  try {
    const output = execFileSync(
      'reg',
      ['query', INTERNET_SETTINGS_KEY],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const enabled = /ProxyEnable\s+REG_DWORD\s+0x1/i.test(output);
    if (!enabled) {
      return undefined;
    }
    const match = output.match(/ProxyServer\s+REG_SZ\s+([^\r\n]+)/i);
    return normalizeProxyUrl(match?.[1]);
  } catch {
    return undefined;
  }
}

export function resolveSapProxyUrl(): string | undefined {
  const explicit = process.env.SAP_ODATA_PROXY_URL;
  if (String(explicit ?? '').trim().toLowerCase() === 'none') {
    return undefined;
  }

  return (
    normalizeProxyUrl(explicit) ||
    normalizeProxyUrl(process.env.HTTPS_PROXY) ||
    normalizeProxyUrl(process.env.https_proxy) ||
    normalizeProxyUrl(process.env.HTTP_PROXY) ||
    normalizeProxyUrl(process.env.http_proxy) ||
    readWindowsProxy()
  );
}

export function createSapFetch(): typeof fetch {
  const proxyUrl = resolveSapProxyUrl();
  if (!proxyUrl) {
    return globalThis.fetch;
  }

  const dispatcher = new ProxyAgent(proxyUrl);
  return ((input: RequestInfo | URL, init?: RequestInit) =>
    globalThis.fetch(input, {
      ...init,
      dispatcher,
    } as RequestInit & { dispatcher: ProxyAgent })) as typeof fetch;
}
