import { Pool, PoolClient } from 'pg';

let pool: Pool;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 60_000,
      connectionTimeoutMillis: 10_000,
      ssl: process.env.DATABASE_URL?.includes('neon')
        ? { rejectUnauthorized: false }
        : false,
    });

    pool.on('error', (err) => {
      console.error('[DB] pool error:', err.message);
    });

    // Keep Neon connections alive (prevent cold-start)
    setInterval(() => {
      pool.query('SELECT 1').catch(() => {});
    }, 4 * 60 * 1000);
  }
  return pool;
}

/**
 * Query with RLS org isolation.
 * Sets app.org_id session variable so RLS policies activate.
 */
export async function queryWithOrg<T = any>(
  orgId: string,
  sql: string,
  params: any[] = []
): Promise<{ rows: T[] }> {
  const client = await getPool().connect();
  const t0 = Date.now();
  try {
    await client.query(`SET LOCAL app.org_id = '${orgId.replace(/'/g, "''")}'`);
    const result = await client.query(sql, params);
    const ms = Date.now() - t0;

    // Extract table name from SQL for readable log
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    const table = tableMatch?.[1] ?? 'unknown';
    const preview = sql.replace(/\s+/g, ' ').trim().slice(0, 120);

    console.log(
      `[sql] table=${table} rows=${result.rowCount} time=${ms}ms` +
      (params.length ? ` params=${JSON.stringify(params)}` : '') +
      `\n      ${preview}`
    );

    return { rows: result.rows as T[] };
  } finally {
    client.release();
  }
}

/**
 * Transaction with RLS org isolation.
 */
export async function transactWithOrg<T>(
  orgId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.org_id = '${orgId.replace(/'/g, "''")}'`);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Raw query without RLS — used only by sync-worker and setup scripts.
 */
export async function queryRaw<T = any>(
  sql: string,
  params: any[] = []
): Promise<{ rows: T[] }> {
  const result = await getPool().query(sql, params);
  return { rows: result.rows as T[] };
}

export async function warmupDb(): Promise<void> {
  try {
    await getPool().query('SELECT 1');
    console.log('[DB] connection warmed up');
  } catch (err: any) {
    console.error('[DB] warmup failed:', err.message);
  }
}
