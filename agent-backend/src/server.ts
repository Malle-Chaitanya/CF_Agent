import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { queryRoute } from './routes/query';
import { actionRoute } from './routes/action';
import { historyRoute } from './routes/history';
import { warmupDb } from './db/client';
import { getRedis } from './session/redis';

const server = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

async function start() {
  await server.register(helmet, { contentSecurityPolicy: false });

  const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  await server.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (server-to-server, Postman) or any localhost in dev
      if (!origin) return cb(null, true);
      if (
        allowedOrigins.includes(origin) ||
        (process.env.NODE_ENV !== 'production' && /^https?:\/\/(.+\.)?localhost(:\d+)?$/.test(origin))
      ) {
        return cb(null, true);
      }
      cb(new Error(`CORS: origin "${origin}" not allowed`), false);
    },
    credentials: true,
  });

  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 hour',
    keyGenerator: (req) => {
      // Rate limit per org (extracted from JWT) or IP fallback
      return (req as any).orgId ?? req.ip;
    },
  });

  // Health check
  server.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

  // Agent routes
  await server.register(queryRoute, { prefix: '/api/agent' });
  await server.register(actionRoute, { prefix: '/api/agent' });
  await server.register(historyRoute, { prefix: '/api/agent' });

  // Warm up DB connection (Neon cold-start prevention)
  await warmupDb();

  const port = Number(process.env.PORT ?? 3002);
  await server.listen({ port, host: '0.0.0.0' });
  console.log(`CF Agent backend running on port ${port}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
