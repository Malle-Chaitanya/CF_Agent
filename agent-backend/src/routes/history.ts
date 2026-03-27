import { FastifyInstance } from 'fastify';
import { authHook, getAuth } from '../middleware/auth';
import { queryWithOrg } from '../db/client';

export async function historyRoute(server: FastifyInstance) {
  server.get('/history', { preHandler: authHook }, async (req, reply) => {
    const { orgId } = getAuth(req);
    const query = req.query as any;
    const limit = Math.min(Number(query.limit ?? 20), 50);
    const before = query.before ? new Date(query.before) : null;

    const { rows } = await queryWithOrg(
      orgId,
      `SELECT id, question,
              widgets->0->>'type' AS primary_widget_type,
              jsonb_array_length(COALESCE(widgets, '[]'::jsonb)) AS widget_count,
              tokens_used, duration_ms, guardrail_triggered, created_at
       FROM agent_runs
       WHERE org_id = $1
         ${before ? `AND created_at < '${before.toISOString()}'` : ''}
       ORDER BY created_at DESC
       LIMIT $2`,
      [orgId, limit]
    );

    return reply.send({ runs: rows });
  });
}
