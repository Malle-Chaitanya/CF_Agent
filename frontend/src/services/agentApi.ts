export interface AgentResponse {
  response: string;
  session_id?: string;
}

const API_URL =
  process.env.NEXT_PUBLIC_AGENT_API_URL ?? "http://localhost:8082";

// Session ID persisted for the lifetime of the browser tab.
// Keeps conversation context alive across follow-up messages
// (e.g. "yes run it" knows which workflow was just created).
let _sessionId: string = "";

export function getSessionId(): string {
  return _sessionId;
}

export function clearSession(): void {
  _sessionId = "";
}

export async function askAgent(prompt: string): Promise<AgentResponse> {
  const res = await fetch(`${API_URL}/agent/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      session_id: _sessionId, // send back the session id on every request
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    let message = text;
    try {
      const json = JSON.parse(text) as { detail?: string | { msg?: string }[]; error?: string };
      if (Array.isArray(json.detail)) {
        message = json.detail.map((d) => d?.msg ?? String(d)).join("; ") || text;
      } else if (typeof json.detail === "string") {
        message = json.detail;
      } else {
        message = json.detail ?? json.error ?? text;
      }
    } catch {
      // keep text as-is if not JSON
    }
    throw new Error(`Agent request failed (${res.status}): ${message}`);
  }

  const data: AgentResponse = await res.json();

  // Store the session id returned by the backend so the next message
  // continues the same conversation (Redis memory key).
  if (data.session_id) {
    _sessionId = data.session_id;
  }

  return data;
}