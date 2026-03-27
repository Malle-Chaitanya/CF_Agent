import { Pool } from 'pg';

let pool: Pool;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      ssl: process.env.DATABASE_URL?.includes('neon')
        ? { rejectUnauthorized: false }
        : false,
    });
    pool.on('error', (err) => console.error('[sync-db] pool error:', err.message));
  }
  return pool;
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const { rows } = await getPool().query(sql, params);
  return rows as T[];
}

/**
 * Bulk upsert using ON CONFLICT.
 * columns: all columns to insert
 * conflictKeys: columns that form the unique constraint
 * updateColumns: columns to update on conflict (exclude immutable ones like id, org_id)
 */
export async function bulkUpsert(
  table: string,
  rows: Record<string, any>[],
  conflictKeys: string[],
  updateColumns: string[]
): Promise<void> {
  if (!rows.length) return;

  const columns = Object.keys(rows[0]);
  const valueRows = rows.map((row) =>
    `(${columns.map((_, i) => `$${i + 1}`).join(', ')})`
  );

  // Build parameterised values
  const allParams: any[] = [];
  const valueClauses: string[] = rows.map((row) => {
    const start = allParams.length + 1;
    columns.forEach((col) => allParams.push(row[col] ?? null));
    return `(${columns.map((_, i) => `$${start + i}`).join(', ')})`;
  });

  const updateSet = updateColumns
    .map((col) => `${col} = EXCLUDED.${col}`)
    .join(', ');

  const sql = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES ${valueClauses.join(', ')}
    ON CONFLICT (${conflictKeys.join(', ')}) DO UPDATE SET ${updateSet}
  `;

  await getPool().query(sql, allParams);
}

export async function saveResumeToken(collection: string, token: any): Promise<void> {
  await getPool().query(
    `INSERT INTO sync_resume_tokens (collection, resume_token, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (collection) DO UPDATE SET resume_token = $2, updated_at = NOW()`,
    [collection, JSON.stringify(token)]
  );
}

export async function getResumeToken(collection: string): Promise<any | null> {
  const { rows } = await getPool().query(
    `SELECT resume_token FROM sync_resume_tokens WHERE collection = $1`,
    [collection]
  );
  return rows[0]?.resume_token ?? null;
}

export async function updateSyncState(
  orgId: string,
  collection: string,
  recordCount: number,
  error?: string
): Promise<void> {
  await getPool().query(
    `INSERT INTO sync_state (org_id, collection, last_synced, record_count, status, error_msg)
     VALUES ($1, $2, NOW(), $3, $4, $5)
     ON CONFLICT (org_id, collection) DO UPDATE
     SET last_synced = NOW(), record_count = $3, status = $4, error_msg = $5`,
    [orgId, collection, recordCount, error ? 'error' : 'ok', error ?? null]
  );
}
