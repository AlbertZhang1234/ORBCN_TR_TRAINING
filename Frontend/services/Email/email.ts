import nodemailer from 'nodemailer';

import { ServiceError } from '../_core/error';
import { getResolvedSmtpConfig } from './config';

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface EmailSendResult {
  messageId: string;
}

export function createEmailTransport() {
  const smtp = getResolvedSmtpConfig();

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.auth.user,
      pass: smtp.auth.pass,
    },
    tls: {
      rejectUnauthorized: smtp.verifyTls,
    },
  });

  return { smtp, transporter };
}

function normalizeRecipient(value: string | string[]): string {
  return Array.isArray(value) ? value.join(', ') : value;
}

export async function sendEmail(options: EmailOptions): Promise<EmailSendResult> {
  const { smtp, transporter } = createEmailTransport();

  let info;
  try {
    info = await transporter.sendMail({
      from: smtp.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ServiceError(`SMTP send failed via ${smtp.host}:${smtp.port} (${message})`, {
      code: 'SMTP_SEND_FAILED',
    });
  }

  console.log(`[Email] Sent to ${normalizeRecipient(options.to)}: ${options.subject}`);
  return {
    messageId: String(info.messageId ?? ''),
  };
}
