import { z } from 'zod';

// Prompt injection patterns — Layer 3 guardrail
const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|your|the above)\s+instructions/i,
  /system\s*prompt/i,
  /jailbreak/i,
  /forget\s+everything/i,
  /\bact\s+as\b/i,
  /\byou\s+are\s+now\b/i,
  /\bpretend\s+(you\s+are|to\s+be)\b/i,
  /<\|im_start\|>/i,
  /\[INST\]/i,
  /###\s*instruction/i,
  /override\s+(safety|your|all)/i,
  /disregard\s+(previous|all|your)/i,
];

function isInjectionAttempt(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

export const QueryInputSchema = z.object({
  question: z
    .string()
    .min(3, 'Question must be at least 3 characters')
    .max(500, 'Question must be 500 characters or less')
    .refine((q) => !isInjectionAttempt(q), {
      message: 'Invalid input detected',
    }),
  session_id: z.string().uuid('Invalid session_id format').optional(),
  context: z
    .object({
      current_page: z.string().max(100).optional(),
      selected_app_id: z.string().max(100).optional(),
    })
    .optional(),
});

export const ActionInputSchema = z.object({
  run_id: z.string().uuid('Invalid run_id'),
  action: z.enum([
    'create_onboard_workflow',
    'run_onboard_workflow',
    'create_offboard_workflow',
    'run_offboard_workflow',
    'approve_offboard_workflow',
    'delete_workflow',
    'create_conditional_workflow',
    'pre_register_user',
  ]),
  payload: z.record(z.unknown()),
});

export type QueryInput = z.infer<typeof QueryInputSchema>;
export type ActionInput = z.infer<typeof ActionInputSchema>;
