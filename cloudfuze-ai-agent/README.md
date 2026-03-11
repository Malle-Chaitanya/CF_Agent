# CloudFuze AI Agent

AI assistant for managing SaaS users via the CloudFuze backend API.  
Converts natural-language admin prompts into structured API calls against the CloudFuze user-management service.

---

## Features

| Capability | Example prompt |
|---|---|
| **Onboard a user** | *"Onboard john@company.com to Slack"* |
| **Offboard a user** | *"Delete Rahul from Google Workspace"* |
| **List users** | *"List inactive Slack users"* |
| **Count users** | *"How many Slack users exist?"* |
| **Reset password** | *"Reset password for john@company.com in Slack"* |
| **Show user apps** | *"What apps does Rahul use?"* |

---

## Quick Start

### 1. Clone and install

```bash
cd cloudfuze-ai-agent
pip install -r requirements.txt
```

### 2. Configure environment

Copy the example and fill in your keys:

```bash
cp .env.example .env
```

**.env** (minimum required):

```
OPENAI_API_KEY=sk-your-openai-api-key
CLOUDFUZE_BASE_URL=http://localhost:8080
CLOUDFUZE_TOKEN=your-cloudfuze-bearer-token
```

All variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | Yes | — | OpenAI API key |
| `OPENAI_MODEL` | No | `gpt-4o` | OpenAI model to use |
| `CLOUDFUZE_BASE_URL` | No | `http://localhost:8080` | CloudFuze backend URL |
| `CLOUDFUZE_TOKEN` | Yes | — | Bearer token for CloudFuze API |
| `REDIS_URL` | No | `redis://localhost:6379/0` | Redis connection string |
| `DEBUG` | No | `false` | Enable debug logging & tool-call printing |
| `LOG_LEVEL` | No | `INFO` | Python log level |
| `API_REQUEST_TIMEOUT` | No | `30` | Timeout (seconds) for CloudFuze API calls |
| `API_MAX_RETRIES` | No | `3` | Retry count on transient failures |

### 3. Run

```bash
python main.py
```

The server starts on **http://localhost:8000**.

---

## API Reference

### `POST /agent/query`

Send a natural-language prompt and receive the agent's response.

**Request:**

```json
{
  "prompt": "Onboard john@company.com to Slack",
  "session_id": "optional-session-id"
}
```

**Response:**

```json
{
  "response": "User john@company.com has been successfully onboarded to Slack.",
  "session_id": "generated-or-echoed-session-id"
}
```

### `GET /health`

Liveness probe. Returns `{"status": "ok"}`.

---

## Project Structure

```
cloudfuze-ai-agent/
├── main.py                       # FastAPI entry point
├── config.py                     # Environment-based configuration
├── requirements.txt
├── README.md
├── .env.example
│
├── agents/
│   └── user_management_agent.py  # OpenAI function-calling agent
│
├── services/
│   └── cloudfuze_api_client.py   # HTTP client for CloudFuze backend
│
├── tools/
│   ├── create_user.py            # Onboard user tool
│   ├── delete_user.py            # Offboard user tool
│   ├── get_users.py              # List users tool
│   ├── count_users.py            # Count users tool
│   ├── reset_password.py         # Reset password tool
│   └── get_user_apps.py          # Get user apps tool
│
├── prompts/
│   └── system_prompt.txt         # System prompt for the LLM
│
├── schemas/
│   └── tool_schema.py            # OpenAI function-calling tool definitions
│
└── memory/
    └── redis_memory.py           # Redis-backed conversation memory
```

---

## Debug Mode

Set `DEBUG=true` in your `.env`. Tool calls will print:

```
[DEBUG] Selected tool : create_user
[DEBUG] Parameters    : {
  "email": "john@company.com",
  "vendor": "Slack",
  "admin_member_id": "admin-123"
}
```

---

## Backend Endpoints (CloudFuze Java API)

The agent calls these REST endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/user/{adminMemberId}/users` | List users |
| `GET` | `/api/user/count` | Count users |
| `POST` | `/api/user/onBoard/runFlow` | Onboard a user |
| `POST` | `/api/user/offBoard/runFlow` | Offboard a user |
| `POST` | `/api/user/offBoard/pwd` | Reset password |
| `GET` | `/api/user/users/apps/{email}` | Get user's apps |
| `GET` | `/api/user/apps/roles/{adminCloudId}` | Get app roles |

---

## Example Prompts

```
"Onboard john@company.com to Slack"
"Delete Rahul from Google Workspace"
"How many users are there?"
"Reset password for john@company.com in Slack"
"What apps does rahul@company.com use?"
"List inactive Slack users"
"Show all users in GitHub"
```
