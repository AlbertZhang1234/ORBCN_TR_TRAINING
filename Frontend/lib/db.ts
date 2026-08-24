import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | undefined;

function normalizeDbError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error('Database query failed');
  }

  const pgError = error as Error & { code?: string; hostname?: string };
  if (pgError.code === 'ENOTFOUND') {
    const host = String(pgError.hostname ?? '').trim();
    const suffix = host ? `: ${host}` : '';
    return new Error(`Database host could not be resolved${suffix}. Check DATABASE_URL.`);
  }

  return error;
}

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // ssl: { rejectUnauthorized: false }, // Use this if needed for production
    });
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[],
): Promise<T[]> {
  const p = getPool();
  const start = Date.now();
  let res: pg.QueryResult<T>;
  try {
    res = await p.query<T>(text, params);
  } catch (error) {
    throw normalizeDbError(error);
  }
  const duration = Date.now() - start;
  // console.log('executed query', { text, duration, rows: res.rowCount });
  return res.rows;
}

export async function queryOne<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}
