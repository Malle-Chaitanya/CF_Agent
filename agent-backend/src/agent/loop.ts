import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { buildSystemPrompt } from './systemPrompt';
import { TOOL_DEFINITIONS } from '../tools/definitions';
import { dispatchTool } from '../tools/handlers';
import { extractWidgets } from './responseBuilder';
import { queryRaw } from '../db/client';
import { getSession, appendToSession } from '../session/redis';
import type { LangfuseTraceClient } from 'langfuse';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_ITERATIONS = 5;
const AGENT_TIMEOUT_MS = 30_000;

export interface AgentLoopParams {
  question: string;
  orgId: string;
  userId: string;
  role: string;
  sessionId?: string;
  context?: { current_page?: string; selected_app_id?: string };
  trace?: LangfuseTraceClient | null;
}

export interface AgentResult {
  runId: string;
  sessionId: string;
  text: string;
  widgets: any[];
  followUp: string[];
  tokensUsed: number;
  durationMs: number;
  guardrailTriggered: boolean;
  toolResultsSummary: string;
}

export async function runAgentLoop(params: AgentLoopParams): Promise<AgentResult> {
  const startTime = Date.now();
  const runId = uuidv4();
  const sessionId = params.sessionId ?? uuidv4();

  // Load conversation history from Redis session
  const session = await getSession(sessionId);
  const history: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (session?.messages?.length) {
    for (const msg of session.messages) {
      history.push({ role: msg.role as any, content: msg.content });
    }
  }

  // Build messages array — system prompt first, then history, then new question
  const systemPrompt = buildSystemPrompt(params.orgId, params.role);
  const userContent = buildUserMessage(params.question, params.context);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userContent },
  ];

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[agent] ► question: "${params.question}"`);
  console.log(`[agent]   org=${params.orgId}  session=${sessionId}`);
  console.log(`${'─'.repeat(60)}`);

  let totalTokens = 0;
  let finalText = '';
  let iterations = 0;
  const collectedToolResults: { tool: string; result: string }[] = [];
  const { trace } = params;

  const timeoutHandle = setTimeout(() => {
    console.error('[loop] agent timeout after', AGENT_TIMEOUT_MS, 'ms');
  }, AGENT_TIMEOUT_MS);

  try {
    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const iterationStart = Date.now();
      const iterStartTime = new Date();
      const generation = trace?.generation({
        name: `llm-iteration-${iterations}`,
        model: 'gpt-4o',
        input: messages,
        startTime: iterStartTime,
      });

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 4096,
        temperature: 0.1,
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
        messages,
      });

      const usage = response.usage;
      if (usage) totalTokens += usage.total_tokens;

      const choice = response.choices[0];
      if (!choice) {
        generation?.end({ output: null, endTime: new Date() });
        break;
      }

      const message = choice.message;
      const iterLatencyMs = Date.now() - iterationStart;

      generation?.end({
        output: message,
        endTime: new Date(),
        usage: {
          input: usage?.prompt_tokens,
          output: usage?.completion_tokens,
          total: usage?.total_tokens,
        },
        metadata: { latencyMs: iterLatencyMs, iteration: iterations },
      });

      // Collect text from response
      if (message.content) {
        finalText = message.content;
      }

      // Done — no tool calls
      if (choice.finish_reason === 'stop') {
        break;
      }

      // GPT wants to call tools
      if (choice.finish_reason === 'tool_calls' && message.tool_calls?.length) {

        // Add assistant message (with tool_calls) to history
        messages.push(message);

        // Execute all tool calls in parallel
        const toolResults = await Promise.all(
          message.tool_calls.map(async (tc) => {
            const fn = (tc as any).function;
            const args = JSON.parse(fn?.arguments || '{}');
            const t0 = Date.now();
            const toolStartTime = new Date();
            console.log(`\n[tool:call] ► ${fn?.name}  args=${JSON.stringify(args)}`);

            const toolSpan = trace?.span({
              name: `tool-${fn?.name}`,
              input: args,
              startTime: toolStartTime,
            });

            try {
              const result = await dispatchTool(fn?.name, args, params.orgId);
              const ms = Date.now() - t0;
              const rowCount = Array.isArray(result) ? result.length
                : Array.isArray(result?.rows) ? result.rows.length
                : Array.isArray(result?.groups) ? result.groups.length
                : Array.isArray(result?.renewals) ? result.renewals.length
                : Array.isArray(result?.unused_licenses) ? result.unused_licenses.length
                : typeof result === 'object' ? Object.keys(result).length : 1;
              console.log(`[tool:done] ✓ ${fn?.name}  returned=${rowCount} items  time=${ms}ms`);

              toolSpan?.end({ output: result, endTime: new Date(), metadata: { latencyMs: ms, rowCount } });

              const resultStr = JSON.stringify(result);
              collectedToolResults.push({ tool: fn?.name, result: resultStr.slice(0, 2000) });

              return {
                role: 'tool' as const,
                tool_call_id: tc.id,
                content: resultStr,
              };
            } catch (err: any) {
              console.error(`[tool:err]  ✗ ${fn?.name}  error=${err.message}`);
              toolSpan?.end({ output: { error: err.message }, endTime: new Date(), level: 'ERROR', metadata: { latencyMs: Date.now() - t0 } });
              return {
                role: 'tool' as const,
                tool_call_id: tc.id,
                content: JSON.stringify({ error: err.message }),
              };
            }
          })
        );

        // Add all tool results to messages
        messages.push(...toolResults);
        continue;
      }

      // max_tokens or other stop reason — exit
      break;
    }
  } finally {
    clearTimeout(timeoutHandle);
  }

  // Extract widget JSON from the final response text
  const widgetStart = Date.now();
  const widgetStartTime = new Date();
  const widgetSpan = trace?.span({ name: 'widget-extraction', input: finalText, startTime: widgetStartTime });
  const { text, widgets, followUp } = extractWidgets(finalText);
  widgetSpan?.end({ output: { widgetCount: widgets.length, types: widgets.map((w) => w.type) }, endTime: new Date(), metadata: { latencyMs: Date.now() - widgetStart } });

  const durationMs = Date.now() - startTime;

  console.log(`${'─'.repeat(60)}`);
  console.log(`[agent] ✓ done  iterations=${iterations}  tokens=${totalTokens}  time=${durationMs}ms  widgets=${widgets.length}`);
  console.log(`${'═'.repeat(60)}\n`);

  // Log run to DB (fire-and-forget — don't block response)
  logAgentRun({
    runId,
    orgId: params.orgId,
    userId: params.userId,
    question: params.question,
    sessionId,
    messages: messages.slice(-10),
    widgets,
    tokensUsed: totalTokens,
    durationMs,
  }).catch((err) => console.error('[loop] failed to log run:', err));

  // Save to session (for conversation memory)
  await appendToSession(sessionId, params.orgId, params.userId, params.question, text);

  const toolResultsSummary = collectedToolResults
    .map((t) => `[${t.tool}]: ${t.result}`)
    .join('\n');

  return {
    runId,
    sessionId,
    text,
    widgets,
    followUp,
    tokensUsed: totalTokens,
    durationMs,
    guardrailTriggered: false,
    toolResultsSummary,
  };
}

function buildUserMessage(question: string, context?: AgentLoopParams['context']): string {
  if (!context?.current_page && !context?.selected_app_id) return question;
  const parts = [question];
  if (context.current_page) parts.push(`(Current page: ${context.current_page})`);
  if (context.selected_app_id) parts.push(`(Selected app: ${context.selected_app_id})`);
  return parts.join(' ');
}

async function logAgentRun(params: {
  runId: string;
  orgId: string;
  userId: string;
  question: string;
  sessionId: string;
  messages: any[];
  widgets: any[];
  tokensUsed: number;
  durationMs: number;
}): Promise<void> {
  await queryRaw(
    `INSERT INTO agent_runs
       (id, org_id, user_id, question, session_id, messages, widgets, tokens_used, duration_ms, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed')`,
    [
      params.runId,
      params.orgId,
      params.userId,
      params.question,
      params.sessionId,
      JSON.stringify(params.messages),
      JSON.stringify(params.widgets),
      params.tokensUsed,
      params.durationMs,
    ]
  );
}
