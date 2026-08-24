import { query, queryOne } from '../../lib/db';
import { sendEmail } from '../Email/email';
import { ServiceError } from '../_core/error';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const TABLE_NAME = 'password_reset_tokens';
const USER_TABLE = 'otto_user';
const DEFAULT_RESET_BASE_URL = 'http://localhost:8200';

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS "${TABLE_NAME}" (
      token TEXT PRIMARY KEY,
      userid TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

export async function requestPasswordReset(account: string) {
  if (!account) throw new ServiceError('Account is required');

  await ensureTable();

  // Find user
  const normalized = account.trim().toLowerCase();
  const user = await queryOne<{ userid: string; email: string; firstname?: string }>(
    `SELECT userid, email, firstname FROM "${USER_TABLE}" WHERE LOWER(userid) = $1 OR LOWER(email) = $1 LIMIT 1`,
    [normalized]
  );

  if (!user || !user.email) {
    // Return silently or with generic message to prevent enumeration, 
    // but requirements say "If email not found give a hint". 
    // So I will throw error if not found.
    throw new ServiceError('User or email not found');
  }

  // Generate token
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Store token
  await query(
    `INSERT INTO "${TABLE_NAME}" (token, userid, expires_at) VALUES ($1, $2, $3)`,
    [token, user.userid, expiresAt]
  );

  // Send email
  const configuredBaseUrl =
    process.env.PASSWORD_RESET_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    DEFAULT_RESET_BASE_URL;
  const baseUrl = configuredBaseUrl.replace(/\/+$/, '');
  const resetLink = `${baseUrl}/pc/reset-password?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: 'Password Reset Request',
    text: `Hello ${user.firstname || 'User'},\n\nYou requested a password reset. Click the link below to reset your password:\n\n${resetLink}\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nTravel Reimbursement Team`,
    html: `
      <p>Hello ${user.firstname || 'User'},</p>
      <p>You requested a password reset. Click the link below to reset your password:</p>
      <p><a href="${resetLink}">Reset Password</a></p>
      <p>If you did not request this, please ignore this email.</p>
      <br/>
      <p>Best regards,</p>
      <p>Travel Reimbursement Team</p>
    `,
  });

  return { success: true, message: 'Reset email sent' };
}

export async function verifyToken(token: string) {
  if (!token) throw new ServiceError('Token is required');

  await ensureTable();

  const record = await queryOne<{ userid: string; expires_at: Date }>(
    `SELECT userid, expires_at FROM "${TABLE_NAME}" WHERE token = $1`,
    [token]
  );

  if (!record) {
    throw new ServiceError('Invalid or expired token');
  }

  if (new Date() > new Date(record.expires_at)) {
    throw new ServiceError('Token has expired');
  }

  return { valid: true, userid: record.userid };
}

export async function resetPassword(token: string, newPassword: string) {
  if (!newPassword) throw new ServiceError('Password is required');

  const { userid } = await verifyToken(token);

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(newPassword, salt);

  // Update user
  await query(
    `UPDATE "${USER_TABLE}" SET password = $1 WHERE userid = $2`,
    [hash, userid]
  );

  // Delete token (and potentially all tokens for this user to be safe)
  await query(`DELETE FROM "${TABLE_NAME}" WHERE token = $1`, [token]);

  return { success: true };
}
