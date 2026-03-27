const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL ?? 'http://localhost:3002';
const SESSION_KEY = 'cf_agent_session_id';

export interface Widget {
  type: 'table' | 'metric_cards' | 'bar_chart' | 'donut_chart' | 'timeline' | 'action_buttons' | 'text_block';
  [key: string]: any;
}

export interface AgentResponse {
  run_id: string | null;
  session_id: string | null;
  text: string;
  widgets: Widget[];
  follow_up: string[];
  tokens_used: number;
  duration_ms: number;
  guardrail_triggered: boolean;
}

export interface ActionResponse {
  success: boolean;
  data?: any;
  widgets?: Widget[];
  error?: string;
}

function getSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(SESSION_KEY);
}

function saveSessionId(id: string): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(SESSION_KEY, id);
  }
}

export function clearSession(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

export function setSessionId(id: string | null): void {
  if (typeof window === 'undefined') return;
  if (id) sessionStorage.setItem(SESSION_KEY, id);
  else sessionStorage.removeItem(SESSION_KEY);
}

export async function askAgent(
  question: string,
  token: string,
  context?: { current_page?: string; selected_app_id?: string }
): Promise<AgentResponse> {
  const sessionId = getSessionId();

  const res = await fetch(`${AGENT_URL}/api/agent/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question, session_id: sessionId ?? undefined, context }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  const data: AgentResponse = await res.json();
  if (data.session_id) saveSessionId(data.session_id);
  return data;
}

export async function executeAction(
  runId: string,
  action: string,
  payload: Record<string, any>,
  token: string
): Promise<ActionResponse> {
  const res = await fetch(`${AGENT_URL}/api/agent/action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ run_id: runId, action, payload }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

export async function getAgentHistory(token: string, limit = 20) {
  const res = await fetch(`${AGENT_URL}/api/agent/history?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.runs ?? [];
}
