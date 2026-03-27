/**
 * CloudFuze Sync Worker — MongoDB Change Streams → PostgreSQL (Neon)
 *
 * Pure Change Stream architecture — no backfill, no REST API.
 * Resume tokens stored in Neon so restarts pick up exactly where they left off.
 *
 * Watching 6 collections:
 *  SaaSVendor           → apps_mirror       (domain=sacontain, deleted=false)
 *  SaaSUser             → users_mirror      (domain=sacontain, deleted=false)
 *  Subscriptions        → licenses_mirror   (domain=sacontain, deleted=false)
 *  ShadowAppsDetailsQueue → shadow_it_mirror  (userId)
 *  CFGroup              → groups_mirror     (userId, membersCount > 0)
 *  UserFinancialMetrics → spend_mirror      (domain=sacontain)
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

import { startAppsWatcher }     from './watchers/apps';
import { startUsersWatcher }    from './watchers/users';
import { startLicensesWatcher } from './watchers/licenses';
import { startShadowITWatcher } from './watchers/shadowit';
import { startGroupsWatcher }   from './watchers/groups';
import { startSpendWatcher }    from './watchers/spend';
import { getPool }              from './db/client';

const MONGO_URI = process.env.MONGODB_URI      ?? '';
const ORG_ID    = process.env.BOOTSTRAP_ORG_ID ?? 'sacontain';
const USER_ID   = process.env.DEV_USER_ID       ?? '66f3b3391a96742043e475af';

async function main() {
  if (!MONGO_URI) {
    console.error('[sync] ❌ MONGODB_URI not set in .env');
    process.exit(1);
  }

  // ── Connect MongoDB ──────────────────────────────────────────────────────
  console.log('[sync] Connecting to MongoDB...');
  const mongo = new MongoClient(MONGO_URI, {
    directConnection: true,
    serverSelectionTimeoutMS: 10_000,
  });

  await mongo.connect();

  const hello = await mongo.db('admin').command({ hello: 1 });
  if (!hello.setName) {
    console.error('[sync] ❌ MongoDB is NOT a replica set — Change Streams require a replica set');
    process.exit(1);
  }
  console.log(`[sync] ✅ MongoDB connected — replica set: "${hello.setName}"`);

  // ── Connect PostgreSQL ───────────────────────────────────────────────────
  await getPool().query('SELECT 1');
  console.log('[sync] ✅ PostgreSQL (Neon) connected');

  // ── Start Change Stream Watchers ─────────────────────────────────────────
  console.log(`\n[sync] Starting 6 Change Stream watchers for org "${ORG_ID}"...\n`);

  await Promise.allSettled([
    startAppsWatcher(mongo, ORG_ID),
    startUsersWatcher(mongo, ORG_ID),
    startLicensesWatcher(mongo, ORG_ID),
    startShadowITWatcher(mongo, ORG_ID, USER_ID),
    startGroupsWatcher(mongo, ORG_ID, USER_ID),
    startSpendWatcher(mongo, ORG_ID),
  ]);

  console.log('[sync] 🚀 All 6 watchers running — listening for MongoDB changes...\n');

  // ── Graceful shutdown ────────────────────────────────────────────────────
  const shutdown = async () => {
    console.log('\n[sync] Shutting down...');
    await mongo.close();
    await getPool().end();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT',  shutdown);
}

main().catch((err) => {
  console.error('[sync] Fatal:', err.message);
  process.exit(1);
});
