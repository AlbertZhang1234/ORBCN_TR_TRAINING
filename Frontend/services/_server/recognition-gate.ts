import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Transaction } from './supplier-drafts/repository';
import { ServiceError } from '../_core/error';
import { defaultRecognitionSettings } from '../SystemConfig/model';

export class RecognitionGate {
  constructor(private readonly transaction: Transaction) {}
  private claim(id: string, leaseSeconds: number): Promise<boolean> {
    return this.transaction(async (db) => {
      // Serialize only admission, never hold this transaction during HTTP/model work.
      // A separate lock statement gives READ COMMITTED a fresh snapshot after a waiter
      // acquires the lock, so it sees the preceding transaction's committed lease.
      await db.query('SELECT pg_advisory_xact_lock(8201, 1)');
      const row = (await db.query(
        `WITH expired AS (
           DELETE FROM otto_invoice_recognition_leases WHERE expires_at <= now() RETURNING id
         ), admitted AS (
           INSERT INTO otto_invoice_recognition_leases(id, expires_at)
           SELECT $1, now()+make_interval(secs => $2) WHERE
             (SELECT count(*) FROM otto_invoice_recognition_leases WHERE expires_at > now()) <
             COALESCE((SELECT (value->>'recognition_concurrency')::int
                       FROM otto_system_config WHERE key='invoice_recognition'), $3)
           RETURNING id
         ) SELECT id FROM admitted`,
        [id, leaseSeconds, defaultRecognitionSettings.recognition_concurrency],
      )).rows[0];
      return Boolean(row);
    });
  }
  async acquire(waitSeconds: number, leaseSeconds: number): Promise<() => Promise<void>> {
    const id = randomUUID();
    const deadline = Date.now() + waitSeconds * 1000;
    do {
      if (await this.claim(id, leaseSeconds)) return () => this.transaction(async (db) => {
        await db.query('DELETE FROM otto_invoice_recognition_leases WHERE id=$1', [id]);
      });
      await delay(Math.min(250, Math.max(0, deadline - Date.now())));
    } while (Date.now() < deadline);
    throw new ServiceError('识别服务繁忙，请稍后重试 / Recognition service is busy', { status: 503, code: 'RECOGNITION_BUSY' });
  }
}
