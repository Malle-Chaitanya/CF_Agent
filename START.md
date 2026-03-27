# CloudFuze AI Agent — Startup Guide

## Step 1: Get 2 Missing Credentials

### A) Neon PostgreSQL (free)
1. Go to https://neon.tech → Sign up → New Project → name it `cf-agent`
2. Copy the connection string — looks like:
   `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`
3. Paste it in BOTH:
   - `agent-backend/.env`  → `DATABASE_URL=`
   - `sync-worker/.env`    → `DATABASE_URL=`

### B) Anthropic API Key
1. Go to https://console.anthropic.com → API Keys → Create Key
2. Paste in:
   - `agent-backend/.env`  → `ANTHROPIC_API_KEY=`

---

## Step 2: Create Database Tables (run ONCE)

```bash
cd "agent-backend"
npm run db:setup
```

Expected output:
```
Running 47 SQL statements...
Tables in database:
  agent_actions
  agent_memories
  agent_runs
  apps_mirror
  contracts_mirror
  licenses_mirror
  shadow_it_mirror
  spend_mirror
  sync_resume_tokens
  sync_state
  users_mirror
DB setup complete.
```

---

## Step 3: Start the Backfill (loads data from CloudFuze Java API)

This runs once and fills all mirror tables from the live Java REST API.
The sync-worker will do this automatically on start.

```bash
cd "sync-worker"
npm run dev
```

Expected output:
```
[sync] connecting to MongoDB...
[sync] MongoDB connected
[sync] PostgreSQL connected
[sync] using bootstrap org: sacontain
[backfill] starting full backfill for org sacontain
[backfill] vendors: 181 rows for org sacontain
[backfill] users: 29402 rows for org sacontain
[backfill] licenses: 66 rows for org sacontain
[backfill] spend: 144 rows for org sacontain
[backfill] shadow IT: 4 rows for org sacontain
[backfill] complete for org sacontain
[watcher:apps] started for org sacontain (common.SaaSVendor)        ← waits for replica set
[watcher:users] started for org sacontain (common.SaaSUser)         ← waits for replica set
[watcher:licenses] started for org sacontain (common.Subscriptions) ← waits for replica set
...
```

> ⚠️ Change Stream watchers will error until backend team enables replica set.
> But the BACKFILL works immediately and loads all data via Java REST API.

---

## Step 4: Start Agent Backend (in a new terminal)

```bash
cd "agent-backend"
npm run dev
```

Expected output:
```
[DB] connection warmed up
CF Agent backend running on port 3002
```

Test it:
```bash
curl -X POST http://localhost:3002/api/agent/query \
  -H "Content-Type: application/json" \
  -H "Authorization: dev" \
  -d '{"question": "How many apps do we have?"}'
```

---

## Step 5: Start Frontend (in a new terminal)

```bash
cd "frontend"
npm run dev
```

Open http://localhost:3000 → chat panel is in the bottom-right corner.

---

## Step 6: When Replica Set is Enabled by Backend Team

Update `sync-worker/.env`:
```
# Remove directConnection=true  — replica set is now auto-discovered
MONGODB_URI=mongodb://chaitanya:PASSWORD@208.76.250.107:12987/
```

Restart the sync-worker. Change Streams will start flowing automatically.

---

## Service Map

| Service | Port | Start command | What it does |
|---|---|---|---|
| sync-worker | — | `npm run dev` | MongoDB → PostgreSQL sync |
| agent-backend | 3002 | `npm run dev` | Claude agent + 15 tools |
| frontend | 3000 | `npm run dev` | Chat panel + 7 widgets |
