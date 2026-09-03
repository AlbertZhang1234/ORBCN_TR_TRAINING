import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { RecognitionGate } from '../services/_server/recognition-gate';
import { SystemConfigRepository } from '../services/_server/system-config/repository';
import { ServiceError } from '../services/_core/error';

test('database settings persist with conflict protection and admission is shared by independent clients',
  { skip: process.env.SYSTEM_CONFIG_INTEGRATION !== '1', timeout: 30000 }, async () => {
    const schema = `invoice_config_${randomUUID().replaceAll('-', '')}`;
    const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}`, max: 6 });
    await admin.connect();
    const transaction = async <T>(work: (client: pg.PoolClient) => Promise<T>) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    };
    try {
      await admin.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"`);
      await admin.query(await readFile('../Backend/Database/migration/create_system_config.sql', 'utf8'));
      const repo = new SystemConfigRepository(async (sql, params) => (await pool.query(sql, params)).rows);
      const initial = await repo.read();
      const saved = await repo.save({ ...initial.values, recognition_concurrency: 1 }, initial.version, 'fixture-admin');
      assert.equal((await repo.read()).values.recognition_concurrency, 1);
      await assert.rejects(repo.save(initial.values, initial.version, 'fixture-admin'), (error: ServiceError) => error.status === 409);
      const gateA = new RecognitionGate(transaction), gateB = new RecognitionGate(transaction);
      const releaseA = await gateA.acquire(1, 30);
      await assert.rejects(gateB.acquire(0.02, 30), (error: ServiceError) => error.code === 'RECOGNITION_BUSY');
      await releaseA();
      const releaseB = await gateB.acquire(1, 30);
      await releaseB();
      await repo.save({ ...saved.values, recognition_concurrency: 2 }, saved.version, 'fixture-admin');
      const leases = await Promise.all([gateA.acquire(1, 30), gateB.acquire(1, 30)]);
      assert.equal(Number((await pool.query('SELECT count(*) FROM otto_invoice_recognition_leases')).rows[0].count), 2);
      await assert.rejects(new RecognitionGate(transaction).acquire(0.02, 30));
      await Promise.all(leases.map((release) => release()));
      await pool.query("INSERT INTO otto_invoice_recognition_leases VALUES($1, now()-interval '1 second')", [randomUUID()]);
      const afterCrash = await gateA.acquire(1, 30);
      await afterCrash();
      assert.equal(Number((await pool.query('SELECT count(*) FROM otto_invoice_recognition_leases')).rows[0].count), 0);
    } finally {
      await pool.end();
      if (!/^invoice_config_[a-f0-9]{32}$/.test(schema)) throw new Error('Invalid test schema cleanup target');
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  });
