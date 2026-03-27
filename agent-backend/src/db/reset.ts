/**
 * ⚠️  DESTRUCTIVE — drops ALL tables then recreates from schema.sql
 * Run with: npm run db:reset
 * Then run: npm run seed  (in sync-worker)
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import 'dotenv/config';

const __dirname2 = dirname(fileURLToPath(import.meta.url));

async function reset() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await pool.query('SELECT 1');
  console.log('✅ Connected to Neon PostgreSQL\n');

  // ── 1. Drop everything ───────────────────────────────────────────────────
  console.log('🗑  Dropping all existing tables...');
  await pool.query(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      ) LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
  console.log('✅ All tables dropped\n');

  // ── 2. Recreate from schema.sql ──────────────────────────────────────────
  console.log('🏗  Recreating tables from schema.sql...');
  const sql = readFileSync(join(__dirname2, 'schema.sql'), 'utf8');

  const statements: string[] = [];
  let current = '';

  for (const line of sql.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--') || trimmed === '') continue;
    current += line + '\n';
    if (trimmed.endsWith(';')) {
      const stmt = current.trim().replace(/;$/, '').trim();
      if (stmt.length > 0) statements.push(stmt);
      current = '';
    }
  }

  console.log(`Running ${statements.length} SQL statements...\n`);

  let ok = 0;
  let failed = 0;

  for (const stmt of statements) {
    try {
      await pool.query(stmt);
      ok++;
    } catch (err: any) {
      failed++;
      console.error(`❌ ${err.message?.slice(0, 120)}`);
      console.error(`   Statement: ${stmt.slice(0, 80)}...`);
    }
  }

  console.log(`\n  ✅ Created  : ${ok}`);
  if (failed > 0) console.log(`  ❌ Failed   : ${failed}`);

  // ── 3. Verify ────────────────────────────────────────────────────────────
  const { rows } = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);

  const tableNames = rows.map((r) => r.table_name);
  console.log('\n📦 Tables now in Neon:');
  tableNames.forEach((t) => console.log(`   ✔ ${t}`));

  const required = [
    'apps_mirror', 'users_mirror', 'licenses_mirror', 'spend_mirror',
    'shadow_it_mirror', 'groups_mirror',
    'agent_runs', 'agent_actions', 'agent_memories',
    'sync_resume_tokens', 'sync_state',
  ];

  const missing = required.filter((t) => !tableNames.includes(t));
  if (missing.length === 0) {
    console.log('\n✅ All 11 required tables present. Ready to seed!\n');
    console.log('Next step:  cd sync-worker && npm run seed\n');
  } else {
    console.log('\n⚠️  Missing tables:', missing.join(', '));
  }

  await pool.end();
}

reset().catch((err) => {
  console.error('Reset failed:', err.message);
  process.exit(1);
});
