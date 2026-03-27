import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

export interface AuthContext {
  orgId: string;
  userId: string;
  role: string;
  email?: string;
}

/**
 * Verify CloudFuze JWT and extract org context.
 * org_id is ALWAYS derived from the token — never trusted from client.
 */
export function verifyToken(authHeader: string | undefined): AuthContext {
  // Dev bypass — only works when DEV_ORG_ID is set (never in production)
  const rawToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  // Dev bypass: no token or explicit 'dev' sentinel
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.DEV_ORG_ID &&
    (!rawToken || rawToken === 'dev')
  ) {
    return {
      orgId: process.env.DEV_ORG_ID,
      userId: process.env.DEV_USER_ID ?? 'dev-user',
      role: 'Admin',
    };
  }

  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }

  const token = authHeader.slice(7);

  let payload: any;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET ?? '', {
      algorithms: ['HS256', 'RS256'],
    });
  } catch (err: any) {
    // In development, fall back to decode-without-verify so real CloudFuze tokens
    // (signed with the Java backend secret) still work without sharing the secret.
    if (process.env.NODE_ENV !== 'production') {
      const decoded = jwt.decode(token) as any;
      if (decoded && (decoded.domain || decoded.sub || decoded.orgId)) {
        payload = decoded;
      } else {
        throw new Error(`JWT verification failed: ${err.message}`);
      }
    } else {
      throw new Error(`JWT verification failed: ${err.message}`);
    }
  }

  // CloudFuze JWT structure: { sub, domain, roles[], permissions[] }
  // We use `sub` as userId and `domain` as the org identifier
  const orgId = payload.orgId ?? payload.domain ?? payload.sub;
  const userId = payload.sub ?? payload.userId;
  const role = Array.isArray(payload.roles)
    ? payload.roles[0]
    : payload.role ?? 'Viewer';

  if (!orgId || !userId) {
    throw new Error('JWT missing required claims (orgId/sub)');
  }

  return { orgId, userId, role, email: payload.email };
}

/**
 * Fastify preHandler — attaches auth context to request.
 * Usage: server.addHook('preHandler', authHook) or per-route.
 */
export async function authHook(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const ctx = verifyToken(req.headers.authorization);
    (req as any).auth = ctx;
  } catch (err: any) {
    reply.code(401).send({ error: 'Unauthorized', message: err.message });
  }
}

export function getAuth(req: FastifyRequest): AuthContext {
  const auth = (req as any).auth as AuthContext | undefined;
  if (!auth) throw new Error('Auth context not set — did authHook run?');
  return auth;
}
