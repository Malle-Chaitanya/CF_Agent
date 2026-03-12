# CloudFuze AI Agent

AI assistant for managing SaaS user lifecycle via the **CloudFuze Workflow API**. Converts natural-language admin prompts into workflow operations (onboard, offboard, conditional automations).

---

## Features

| Capability | Example prompt |
|---|---|
| **Create onboard workflow** | *"Onboard john@company.com to Slack"* |
| **Create offboard workflow** | *"Offboard jane@company.com from GitHub"* |
| **Run workflow** | *"Run workflow 123"* |
| **List workflows** | *"Show my workflows"* |
| **Workflow details** | *"Show workflow details for 456"* |
| **Approve offboard** | *"Approve offboard workflow 789"* |
| **Delete workflow** | *"Delete workflow 789"* |
| **Conditional automation** | *"Disable inactive Slack users automatically"* |

---

## Quick Start

### 1. Install

```bash
cd cloudfuze-ai-agent
pip install -r requirements.txt
```

### 2. Configure

Copy the example and fill in your keys:

```bash
cp .env.example .env
```

**.env** (minimum):

```
OPENAI_API_KEY=sk-your-openai-api-key
CLOUDFUZE_BASE_URL=https://cloudfuzehost.com/cfcommon
CLOUDFUZE_TOKEN=your-cloudfuze-bearer-token
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | Yes | — | OpenAI API key |
| `OPENAI_MODEL` | No | `gpt-4o` | OpenAI model |
| `CLOUDFUZE_BASE_URL` | No | `http://localhost:8080` | CloudFuze backend URL |
| `CLOUDFUZE_TOKEN` | Yes | — | Bearer token for CloudFuze API |
| `REDIS_URL` | No | `redis://localhost:6379/0` | Redis for chat memory |
| `AGENT_PORT` | No | `8082` | Port for this API |
| `DEBUG` | No | `false` | Debug logging |
| `LOG_LEVEL` | No | `INFO` | Log level |
| `API_REQUEST_TIMEOUT` | No | `30` | CloudFuze API timeout (seconds) |
| `API_MAX_RETRIES` | No | `3` | Retries on transient failures |

### 3. Run

```bash
python main.py
```

API docs: **http://localhost:8082/docs**

---

## API Reference

### Chat

- **POST /agent/query** — Send a natural-language prompt; agent runs workflow tools and returns a reply.

### Workflow REST (for frontend / direct calls)

- **GET /workflows** — List all workflows
- **GET /workflows/{workflow_id}** — Get workflow details
- **POST /workflows/{workflow_id}/run** — Execute a workflow (Run button)
- **DELETE /workflows/{workflow_id}** — Delete a workflow
- **GET /workflows/offboard/pending** — List pending offboard workflows
- **PUT /workflows/offboard/approve** — Approve or reject offboard (body: `workflow_id`, `approve_status`: APPROVED | REJECTED)
- **GET /workflows/onboard/{details_id}/users** — Get users for an onboard detail record

### Health

- **GET /health** — Liveness probe

---

## Project Structure

```
cloudfuze-ai-agent/
├── main.py                       # FastAPI entry point + workflow REST endpoints
├── config.py                     # Environment configuration
├── requirements.txt
├── README.md
├── .env.example
├── agents/
│   └── user_management_agent.py # OpenAI function-calling workflow agent
├── services/
│   └── cloudfuze_api_client.py  # CloudFuze Workflow REST API client
├── tools/
│   ├── create_onboard_workflow.py
│   ├── create_offboard_workflow.py
│   ├── create_conditional_workflow.py
│   ├── run_workflow.py
│   ├── list_workflows.py
│   ├── get_workflow_details.py
│   ├── get_onboard_users.py
│   ├── get_offboard_details.py
│   ├── approve_offboard_workflow.py
│   ├── delete_workflow.py
│   └── vendor_utils.py           # Vendor name normalization
├── prompts/
│   └── system_prompt.txt
├── schemas/
│   └── tool_schema.py            # OpenAI tool definitions
└── memory/
    └── redis_memory.py           # Redis-backed conversation memory
```

---

## Workflow lifecycle

- **Onboard:** create_onboard_workflow → admin reviews → **run_workflow** → users provisioned
- **Offboard:** create_offboard_workflow → admin reviews → **approve_offboard_workflow** (APPROVED) → users deprovisioned
- **Conditional:** create_conditional_workflow → runs automatically on condition

---

## Backend endpoints (CloudFuze)

The agent and REST endpoints call:

| Method | Path | Description |
|---|---|---|
| POST | `/api/workflow/onboard/create` | Create onboard workflow |
| POST | `/api/workflow/create/offboardworkflow` | Create offboard workflow |
| POST | `/api/workflow/create/conditionalWorkFlows` | Create conditional workflow |
| POST | `/api/workflow/run/{workFlowId}` | Execute workflow |
| GET | `/api/workflow/get/workflows` | List workflows |
| GET | `/api/workflow/get/workflowsdetails/{workflowId}` | Workflow details |
| GET | `/api/workflow/get/onboarddetails/{id}` | Onboard detail users |
| GET | `/api/workflow/offboarddetails` | Pending offboard list |
| PUT | `/api/workflow/offboarddetails/update` | Approve/reject offboard |
| DELETE | `/api/workflow/delete/{workFlowId}` | Delete workflow |
