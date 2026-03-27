# CloudFuze Manage — AI Chat Agent

Built per PRD v2.2. Three services:

## Services

| Service | Port | Purpose |
|---------|------|---------|
| `agent-backend` | 3002 | Fastify + Claude API agent |
| `sync-worker` | — | MongoDB Change Streams → PostgreSQL |
| `frontend` | 3000 | Next.js chat panel + widgets |

## Setup

### 1. Copy env files
```bash
cp agent-backend/.env.example agent-backend/.env
cp sync-worker/.env.example sync-worker/.env
cp frontend/.env.example frontend/.env
```

### 2. Fill in credentials

**agent-backend/.env**
- `ANTHROPIC_API_KEY` — Claude API key
- `DATABASE_URL` — Neon PostgreSQL URL
- `REDIS_URL` — Redis URL
- `CLOUDFUZE_BASE_URL` — `https://cloudfuzehost.com/cfcommon`
- `CLOUDFUZE_TOKEN` — JWT from CloudFuze
- `JWT_SECRET` — Secret for JWT verification
- `DEV_ORG_ID` — Your org ID (dev only, skip JWT)

**sync-worker/.env**
- `MONGODB_URI` — Direct MongoDB connection string
- `DATABASE_URL` — Same Neon PostgreSQL URL
- `CLOUDFUZE_BASE_URL` + `CLOUDFUZE_TOKEN` — For backfill

### 3. Install dependencies
```bash
cd agent-backend && npm install
cd ../sync-worker && npm install
cd ../frontend && npm install
```

### 4. Create DB tables
```bash
cd agent-backend && npm run db:setup
```

### 5. Start all services
```bash
# Terminal 1
cd agent-backend && npm run dev

# Terminal 2
cd sync-worker && npm run dev

# Terminal 3
cd frontend && npm run dev
```

Open http://localhost:3000 — click the blue "Ask AI" button or press Ctrl+K.

## Architecture

```
Frontend (Next.js)
    ↓ POST /api/agent/query
Agent Backend (Fastify + Claude Sonnet 4.5)
  ├─ Layer 3: Zod input validation (injection blocking)
  ├─ Layer 2: Claude Haiku intent classifier
  ├─ Layer 1: System prompt domain restriction
  ├─ 15 read tools → PostgreSQL mirror
  └─ Confirmed write actions → CloudFuze Java REST API
                                        ↓
Sync Worker (MongoDB Change Streams)  Java Backend (cfcommon)
    ↓                                       ↓
PostgreSQL/Neon (mirror + agent tables)  MongoDB (system of record)
```

## Key Rules

1. Every SQL query has `WHERE org_id = $1` — no exceptions
2. Agent never writes to MongoDB directly
3. All write actions require user confirmation before executing
4. `agent_actions` table is append-only
5. `org_id` always from JWT — never from client request body
6. MongoDB Change Streams only for sync — no REST polling
