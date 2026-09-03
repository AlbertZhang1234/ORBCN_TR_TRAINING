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
      await db.query('SELECT pg_advisory_xact_lock(8201, 1)');
      await db.query('DELETE FROM otto_invoice_recognition_leases WHERE expires_at <= now()');
      const row = (await db.query(
        `INSERT INTO otto_invoice_recognition_leases(id, expires_at)
         SELECT $1, now()+make_interval(secs => $2) WHERE
           (SELECT count(*) FROM otto_invoice_recognition_leases) <
           (SELECT COALESCE((value->>'recognition_concurrency')::int, $3)
            FROM otto_system_config WHERE key='invoice_recognition') RETURNING id`,
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
