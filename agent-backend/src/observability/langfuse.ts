import { Langfuse } from 'langfuse';

// Singleton Langfuse client — reused across all requests
let _client: Langfuse | null = null;

export function getLangfuse(): Langfuse | null {
  const sk = process.env.LANGFUSE_SECRET_KEY;
  const pk = process.env.LANGFUSE_PUBLIC_KEY;
  const host = process.env.LANGFUSE_BASE_URL;

  if (!sk || !pk) {
    console.warn('[langfuse] LANGFUSE_SECRET_KEY or LANGFUSE_PUBLIC_KEY not set — tracing disabled');
    return null;
  }

  if (!_client) {
    console.log(`[langfuse] initialising client  host=${host ?? 'https://cloud.langfuse.com'}  pk=${pk.slice(0, 12)}…`);
    _client = new Langfuse({
      secretKey: sk,
      publicKey: pk,
      baseUrl: host ?? 'https://cloud.langfuse.com',
      flushAt: 1,
      flushInterval: 1000,
      debug: true,
    });
  }

  return _client;
}
