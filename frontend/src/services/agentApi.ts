export interface AgentResponse {
  response: string;
  session_id?: string;
}

const API_URL =
  process.env.NEXT_PUBLIC_AGENT_API_URL ?? "http://localhost:8082";

export async function askAgent(prompt: string): Promise<AgentResponse> {
  const res = await fetch(`${API_URL}/agent/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
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

  return res.json();
}
