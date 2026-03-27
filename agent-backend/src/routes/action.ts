import { FastifyInstance } from 'fastify';
import { authHook, getAuth } from '../middleware/auth';
import { ActionInputSchema } from '../validation/input';
import { executeAction } from '../workflow/actions';

export async function actionRoute(server: FastifyInstance) {
  server.post('/action', { preHandler: authHook }, async (req, reply) => {
    const parseResult = ActionInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        error: 'Invalid action input',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { run_id, action, payload } = parseResult.data;
    const { orgId, userId } = getAuth(req);

    const result = await executeAction(
      action as any,
      payload as any,
      orgId,
      userId,
      run_id
    );

    if (!result.success) {
      return reply.code(422).send({
        error: result.error,
        widgets: [{ type: 'text_block', content: `Action failed: ${result.error}` }],
      });
    }

    return reply.send({
      success: true,
      data: result.data,
      widgets: [
        {
          type: 'text_block',
          content: `✓ Action **${action.replace(/_/g, ' ')}** completed successfully.`,
        },
      ],
    });
  });
}
