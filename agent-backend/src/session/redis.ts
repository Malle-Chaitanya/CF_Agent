import Redis from 'ioredis';

let redis: Redis | null = null;
const SESSION_TTL = 30 * 60; // 30 minutes

export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Session {
  orgId: string;
  userId: string;
  messages: SessionMessage[];
  lastActiveAt: string;
}

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });
    redis.on('error', (err) => console.error('[Redis]', err.message));
  }
  return redis;
}

function sessionKey(sessionId: string): string {
  return `cf:agent:session:${sessionId}`;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  try {
    const raw = await getRedis().get(sessionKey(sessionId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveSession(sessionId: string, session: Session): Promise<void> {
  try {
    await getRedis().setex(
      sessionKey(sessionId),
      SESSION_TTL,
      JSON.stringify(session)
    );
  } catch {
    // Non-fatal — session memory just won't persist
  }
}

export async function appendToSession(
  sessionId: string,
  orgId: string,
  userId: string,
  userMessage: string,
  assistantMessage: string
): Promise<void> {
  const existing = await getSession(sessionId);
  const messages: SessionMessage[] = existing?.messages ?? [];

  messages.push({ role: 'user', content: userMessage });
  messages.push({ role: 'assistant', content: assistantMessage });

  // Keep last 20 messages (10 turns) to stay within token budget
  const trimmed = messages.slice(-20);

  await saveSession(sessionId, {
    orgId,
    userId,
    messages: trimmed,
    lastActiveAt: new Date().toISOString(),
  });
}

export async function clearSession(sessionId: string): Promise<void> {
  try {
    await getRedis().del(sessionKey(sessionId));
  } catch {}
}
