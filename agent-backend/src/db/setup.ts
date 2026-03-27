/**
 * One-time DB setup — run with: npm run db:setup
 * Safe to re-run. Creates missing tables, skips existing ones.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import 'dotenv/config';

const __dirname2 = dirname(fileURLToPath(import.meta.url));

async function setup() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  // Test connection
  await pool.query('SELECT 1');
  console.log('✅ Connected to Neon PostgreSQL');

  const sql = readFileSync(join(__dirname2, 'schema.sql'), 'utf8');

  // Better split: split on lines that are just ';' or end with ';'
  // Collect multi-line statements properly
  const statements: string[] = [];
  let current = '';

  for (const line of sql.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--') || trimmed === '') continue; // skip comments/blank
    current += line + '\n';
    if (trimmed.endsWith(';')) {
      const stmt = current.trim().replace(/;$/, '').trim();
      if (stmt.length > 0) statements.push(stmt);
      current = '';
    }
  }

  console.log(`Running ${statements.length} SQL statements...\n`);

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const stmt of statements) {
    try {
      await pool.query(stmt);
      ok++;
    } catch (err: any) {
      const msg = err.message ?? '';
      if (
        msg.includes('already exists') ||
        msg.includes('duplicate_object') ||
        msg.includes('42710') || // duplicate_object
        msg.includes('42P07')    // duplicate_table
      ) {
        skipped++;
      } else {
        failed++;
        console.error(`❌ ${msg.slice(0, 120)}`);
        console.error(`   Statement: ${stmt.slice(0, 80)}...`);
      }
    }
  }

  console.log(`\n  ✅ Created : ${ok}`);
  console.log(`  ⏭  Skipped : ${skipped} (already existed)`);
  if (failed > 0) console.log(`  ❌ Failed  : ${failed}`);

  // Verify all expected tables exist
  const { rows } = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);

  const tableNames = rows.map((r) => r.table_name);
  console.log('\n📦 Tables in Neon:');
  tableNames.forEach((t) => console.log(`   ${t}`));

  const required = [
    'apps_mirror', 'users_mirror', 'licenses_mirror', 'spend_mirror',
    'shadow_it_mirror', 'groups_mirror',
    'agent_runs', 'agent_actions', 'agent_memories',
    'sync_resume_tokens', 'sync_state',
  ];

  const missing = required.filter((t) => !tableNames.includes(t));
  if (missing.length === 0) {
    console.log('\n✅ All required tables present. DB setup complete.');
  } else {
    console.log('\n⚠️  Missing tables:', missing.join(', '));
  }

  await pool.end();
}

setup().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
