import { FastifyInstance } from 'fastify';
import { authHook, getAuth } from '../middleware/auth';
import { QueryInputSchema } from '../validation/input';
import { classifyIntent } from '../agent/classifier';
import { runAgentLoop } from '../agent/loop';
import { queryRaw } from '../db/client';
import { getLangfuse } from '../observability/langfuse';

export async function queryRoute(server: FastifyInstance) {
  server.post('/query', { preHandler: authHook }, async (req, reply) => {
    // Layer 3: Zod input validation
    const parseResult = QueryInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        error: 'Invalid input',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { question, session_id, context } = parseResult.data;
    const { orgId, userId, role } = getAuth(req);

    // Create top-level Langfuse trace for this agent query
    const requestStart = Date.now();
    const lf = getLangfuse();
    const trace = lf?.trace({
      name: 'agent-query',
      userId,
      sessionId: session_id ?? undefined,
      input: question,
      startTime: new Date(),
      metadata: { orgId, role, current_page: context?.current_page, selected_app_id: context?.selected_app_id },
    }) ?? null;

    console.log(`[langfuse] trace created=${!!trace}  traceId=${(trace as any)?.traceId ?? 'none'}`);

    // Layer 2: intent classifier (traced)
    const classification = await classifyIntent(question, trace);

    if (classification.result === 'OUT_OF_SCOPE') {
      trace?.update({ output: { guardrail: 'OUT_OF_SCOPE', refusal: classification.refusalMessage } });
      lf?.flushAsync()
        .then(() => console.log('[langfuse] flush ok'))
        .catch((err) => console.error('[langfuse] flush error:', err));

      // Log guardrail trigger (fire and forget)
      logGuardrailTrigger({ orgId, userId, question, reason: 'OUT_OF_SCOPE' }).catch(() => {});

      return reply.send({
        run_id: null,
        session_id: session_id ?? null,
        text: classification.refusalMessage,
        widgets: [{ type: 'text_block', content: classification.refusalMessage }],
        follow_up: classification.followUp,
        tokens_used: 0,
        duration_ms: 0,
        guardrail_triggered: true,
      });
    }

    // Layer 1: System prompt scope enforcement happens inside the agent loop
    try {
      const result = await runAgentLoop({
        question,
        orgId,
        userId,
        role,
        sessionId: session_id,
        context,
        trace,
      });

      trace?.update({
        output: result.text,
        metadata: {
          runId: result.runId,
          tokensUsed: result.tokensUsed,
          latencyMs: result.durationMs,
          totalRequestLatencyMs: Date.now() - requestStart,
          widgetCount: result.widgets.length,
          iterations: result.widgets.length > 0 ? 'completed' : 'no-widgets',
          question,
          agent_response: result.text,
          tool_results: result.toolResultsSummary || 'No tools called',
        },
      });
      lf?.flushAsync()
        .then(() => console.log('[langfuse] flush ok'))
        .catch((err) => console.error('[langfuse] flush error:', err));

      return reply.send({
        run_id: result.runId,
        session_id: result.sessionId,
        text: result.text,
        widgets: result.widgets,
        follow_up: result.followUp,
        tokens_used: result.tokensUsed,
        duration_ms: result.durationMs,
        guardrail_triggered: false,
      });
    } catch (err: any) {
      trace?.update({ output: { error: String(err?.message) }, metadata: { status: 'error' } });
      lf?.flushAsync()
        .then(() => console.log('[langfuse] flush ok'))
        .catch((err) => console.error('[langfuse] flush error:', err));
      req.log.error({ err }, 'Agent loop error');
      return reply.code(500).send({
        error: 'Agent error',
        widgets: [{ type: 'text_block', content: 'Something went wrong. Please try again.' }],
        follow_up: [],
      });
    }
  });
}

async function logGuardrailTrigger(params: {
  orgId: string;
  userId: string;
  question: string;
  reason: string;
}): Promise<void> {
  await queryRaw(
    `INSERT INTO agent_runs (org_id, user_id, question, status, guardrail_triggered, out_of_scope_reason, tokens_used, duration_ms)
     VALUES ($1, $2, $3, 'blocked', true, $4, 0, 0)`,
    [params.orgId, params.userId, params.question, params.reason]
  );
}
