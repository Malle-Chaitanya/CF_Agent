import OpenAI from 'openai';
import type { LangfuseTraceClient } from 'langfuse';

// Fast cheap classifier — GPT-4o-mini runs in ~300ms
// Blocks out-of-scope questions before expensive GPT-4o call
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type ClassificationResult =
  | { result: 'IN_SCOPE' }
  | { result: 'OUT_OF_SCOPE'; refusalMessage: string; followUp: string[] }
  | { result: 'AMBIGUOUS' };

const SYSTEM = `You are a classifier for a SaaS management assistant called CloudFuze Manage.

ONLY classify as OUT_OF_SCOPE when the question is CLEARLY and OBVIOUSLY about one of these:
- General trivia or world knowledge (history, science, geography)
- Writing creative content, poems, stories, or emails unrelated to SaaS
- IT helpdesk issues (wifi, printer, laptop, password reset)
- Coding or software development help
- Personal finance, investments, medical or legal advice

For EVERYTHING else respond IN_SCOPE. When in doubt always respond IN_SCOPE.

Reply with EXACTLY one word: IN_SCOPE, OUT_OF_SCOPE, or AMBIGUOUS. Nothing else.`;

// Keyword whitelist — any match = instant IN_SCOPE, no LLM call needed
const IN_SCOPE_KEYWORDS = [
  'app', 'apps', 'application', 'applications', 'software', 'tool', 'tools',
  'saas', 'vendor', 'vendors', 'portfolio', 'connected', 'integrated', 'discovered',
  'user', 'users', 'active', 'inactive', 'department', 'provisioning', 'access',
  'licence', 'licenses', 'licence', 'licences', 'seat', 'seats', 'subscription', 'subscriptions',
  'spend', 'cost', 'costs', 'budget', 'saving', 'savings', 'waste', 'financial', 'money',
  'contract', 'contracts', 'renewal', 'renewals', 'renew', 'expiry', 'expires', 'expiring',
  'shadow', 'unapproved', 'unauthorised', 'unauthorized', 'risk',
  'compliance', 'onboard', 'offboard', 'workflow', 'workflows',
  'how many', 'how much', 'list', 'show me', 'what are', 'which', 'overview', 'summary',
  'total', 'count', 'usage', 'utilisation', 'utilization',
];

function isObviouslyInScope(question: string): boolean {
  const q = question.toLowerCase();
  return IN_SCOPE_KEYWORDS.some((kw) => q.includes(kw));
}

export async function classifyIntent(
  question: string,
  trace?: LangfuseTraceClient | null,
): Promise<ClassificationResult> {
  // Fast path — keyword match bypasses LLM entirely
  if (isObviouslyInScope(question)) {
    trace?.span({ name: 'intent-classifier', input: question, output: 'IN_SCOPE (keyword fast-path)' }).end();
    return { result: 'IN_SCOPE' };
  }

  const t0 = Date.now();
  const startTime = new Date();
  const span = trace?.generation({
    name: 'intent-classifier',
    model: 'gpt-4o-mini',
    input: [{ role: 'system', content: SYSTEM }, { role: 'user', content: question }],
    startTime,
  });

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 10,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: question },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim().toUpperCase() ?? '';
    const latencyMs = Date.now() - t0;

    span?.end({
      output: text,
      endTime: new Date(),
      usage: {
        input: response.usage?.prompt_tokens,
        output: response.usage?.completion_tokens,
        total: response.usage?.total_tokens,
      },
      metadata: { latencyMs },
    });

    if (text.startsWith('OUT_OF_SCOPE')) {
      return {
        result: 'OUT_OF_SCOPE',
        refusalMessage: buildRefusalMessage(question),
        followUp: buildRefusalFollowUp(question),
      };
    }

    if (text.startsWith('AMBIGUOUS')) {
      return { result: 'AMBIGUOUS' };
    }

    return { result: 'IN_SCOPE' };
  } catch (err) {
    // Fail open — if classifier errors, let main agent handle it
    span?.end({ output: 'ERROR', level: 'ERROR' });
    console.error('[classifier] error:', err);
    return { result: 'IN_SCOPE' };
  }
}

function buildRefusalMessage(question: string): string {
  const q = question.toLowerCase();
  if (q.includes('email') || q.includes('write') || q.includes('draft')) {
    return "I can't write emails or general content, but I can generate a Renewal Brief or Usage Summary for any of your SaaS apps. Would that help?";
  }
  if (q.includes('better') || q.includes('recommend') || q.includes('switch') || q.includes('compare')) {
    return "I can't give general product recommendations, but I can show you how your current tools are performing. Would you like a usage or cost breakdown?";
  }
  if (q.includes('helpdesk') || q.includes('password') || q.includes('wifi') || q.includes('laptop')) {
    return "I'm not a helpdesk assistant — I manage your SaaS portfolio. For IT support, please contact your helpdesk team.";
  }
  return "I'm the CloudFuze Manage assistant — I can only help with your SaaS portfolio data. Ask me about your apps, licences, spend, contracts, or user access.";
}

function buildRefusalFollowUp(question: string): string[] {
  const appKeywords = ['figma', 'slack', 'zoom', 'salesforce', 'github', 'notion', 'asana', 'jira', 'google', 'microsoft'];
  const mentioned = appKeywords.find((a) => question.toLowerCase().includes(a));
  if (mentioned) {
    const app = mentioned.charAt(0).toUpperCase() + mentioned.slice(1);
    return [
      `Show ${app} usage in my org`,
      `How many ${app} seats are unused?`,
      `What does ${app} cost us this year?`,
    ];
  }
  return [
    'Give me an overview of my SaaS portfolio',
    'Which apps have unused licences?',
    'What renews in the next 60 days?',
  ];
}
