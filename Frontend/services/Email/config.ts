export interface ResolvedSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  verifyTls: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from?: string;
  to?: string | string[];
}

function readBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

function readNumber(value: string | undefined, defaultValue: number): number {
  if (!value) {
    return defaultValue;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function getResolvedSmtpConfig(): ResolvedSmtpConfig {
  const host = process.env.SMTP_HOST?.trim() || '';
  const port = readNumber(process.env.SMTP_PORT, 0);
  const secure = readBoolean(process.env.SMTP_SECURE, true);
  const verifyTls = readBoolean(process.env.SMTP_VERIFY_TLS, true);
  const user = process.env.SMTP_USER?.trim() || '';
  const pass = process.env.SMTP_PASS?.trim() || '';
  const from = process.env.SMTP_FROM?.trim() || `"${user}" <${user}>`;
  const reimbursementTo =
    process.env.TR_REIMBURSEMENT_TO?.trim() ||
    process.env.NEXT_PUBLIC_TR_RECEIVER?.trim();

  const missing = [
    !host ? 'SMTP_HOST' : '',
    !port ? 'SMTP_PORT' : '',
    !user ? 'SMTP_USER' : '',
    !pass ? 'SMTP_PASS' : '',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`SMTP configuration is incomplete: missing ${missing.join(', ')}`);
  }

  return {
    host,
    port,
    secure,
    verifyTls,
    auth: { user, pass },
    from,
    to: reimbursementTo,
  };
}
