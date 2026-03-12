"""CloudFuze AI Agent — FastAPI entry point.

Run with:
    python main.py
"""

from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field

from config import settings
from agents.user_management_agent import UserManagementAgent
from services.cloudfuze_api_client import api_client, CloudFuzeAPIError

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("cloudfuze-ai-agent")


# ---------------------------------------------------------------------------
# Startup / shutdown
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    missing = settings.validate()
    if missing:
        logger.warning("Missing env vars: %s — some features may not work.", missing)
    logger.info(
        "CloudFuze AI Agent started (model=%s, debug=%s)", settings.OPENAI_MODEL, settings.DEBUG
    )
    logger.info(
        "Docs at: http://localhost:%s/docs", settings.AGENT_PORT
    )
    yield
    logger.info("CloudFuze AI Agent shutting down.")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="CloudFuze AI Agent",
    description=(
        "AI assistant for managing SaaS user lifecycle via CloudFuze Workflow API "
        "(onboard/offboard/conditional workflows)."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

agent = UserManagementAgent()


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)},
    )


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class QueryRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="Natural-language admin prompt.")
    session_id: str = Field(
        default="",
        description="Session ID for conversation continuity. Auto-generated if omitted.",
    )


class QueryResponse(BaseModel):
    response: str
    session_id: str


class WorkflowRunRequest(BaseModel):
    workflow_id: str = Field(..., description="ID of the workflow to execute.")


class ApproveWorkflowRequest(BaseModel):
    workflow_id: str = Field(..., description="ID of the offboard workflow to approve/reject.")
    approve_status: str = Field(
        ..., description="APPROVED or REJECTED.", pattern="^(APPROVED|REJECTED)$"
    )


# ---------------------------------------------------------------------------
# Utility: wrap CloudFuze API errors into HTTPExceptions
# ---------------------------------------------------------------------------
def _cf_call(fn, *args, **kwargs) -> Any:
    try:
        return fn(*args, **kwargs)
    except CloudFuzeAPIError as exc:
        raise HTTPException(status_code=exc.status_code or 502, detail=exc.detail) from exc
    except Exception as exc:
        logger.exception("Unexpected API client error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/docs", status_code=302)


@app.get("/v1", include_in_schema=False)
@app.get("/v1/", include_in_schema=False)
async def v1_redirect():
    return RedirectResponse(url="/docs", status_code=302)


@app.get("/health")
async def health():
    """Liveness probe."""
    return {"status": "ok", "service": "cloudfuze-ai-agent"}


# ---- Chat endpoint --------------------------------------------------------

@app.post("/agent/query", response_model=QueryResponse, tags=["Agent"])
async def agent_query(request: QueryRequest):
    """
    Accept a natural-language admin prompt and return the agent's response.
    The agent will call the appropriate workflow tools automatically.
    """
    session_id = request.session_id or str(uuid.uuid4())
    logger.info("Session=%s | Prompt=%s", session_id, request.prompt[:120])

    try:
        answer = agent.run(session_id=session_id, user_prompt=request.prompt)
    except Exception as exc:
        logger.exception("Agent error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return QueryResponse(response=answer, session_id=session_id)


# ---- Workflow REST endpoints (used directly by frontend buttons) -----------
# IMPORTANT: FastAPI matches routes in registration order.
# Sub-resource routes (/workflows/offboard/..., /workflows/onboard/...)
# MUST be registered BEFORE the generic /{workflow_id} catch-all, otherwise
# FastAPI will match "offboard" as the workflow_id param and never reach them.

@app.get("/workflows", tags=["Workflows"])
async def list_workflows():
    """List all workflows. Used by the frontend to populate the workflow list."""
    result = _cf_call(api_client.list_workflows)
    return {"status": "success", "data": result}


# ---- Sub-resource routes BEFORE generic /{workflow_id} --------------------

@app.get("/workflows/offboard/{workflow_id}/details", tags=["Workflows"])
async def get_offboard_details(workflow_id: str):
    """
    Get offboard details for a specific workflow.
    Uses GET /api/workflow/get/offboarddetails/{workFlowId} on the Java backend.
    NOTE: The old /api/workflow/offboarddetails endpoint 401s without ?workflowId param —
    this endpoint uses the correct path-param version which reads userId from JWT automatically.
    """
    result = _cf_call(api_client.get_offboard_details_by_workflow, workflow_id=workflow_id)
    return {"status": "success", "data": result}


@app.get("/workflows/offboard/{workflow_id}/single", tags=["Workflows"])
async def get_single_offboard_detail(workflow_id: str):
    """
    Get a single offboard detail record by workflow ID.
    Calls GET /api/workflow/offboarddetails?workflowId=... explicitly with the required param.
    """
    result = _cf_call(api_client.get_single_offboard_detail, workflow_id=workflow_id)
    return {"status": "success", "data": result}


@app.get("/workflows/offboard/{workflow_offboard_id}/apps", tags=["Workflows"])
async def get_offboard_apps(workflow_offboard_id: str):
    """List the SaaS apps tied to an offboard workflow record."""
    result = _cf_call(api_client.get_offboard_apps, workflow_offboard_id=workflow_offboard_id)
    return {"status": "success", "data": result}


@app.put("/workflows/offboard/approve", tags=["Workflows"])
async def approve_offboard(request: ApproveWorkflowRequest):
    """
    Approve or reject a pending offboard workflow.
    approve_status must be APPROVED or REJECTED.
    """
    result = _cf_call(
        api_client.approve_offboard_workflow,
        workflow_id=request.workflow_id,
        approve_status=request.approve_status,
    )
    logger.info(
        "workflow | action=approve | workflowId=%s | status=%s",
        request.workflow_id,
        request.approve_status,
    )
    return {"status": "success", "data": result}


@app.get("/workflows/onboard/{details_id}/users", tags=["Workflows"])
async def get_onboard_users(details_id: str):
    """Get users tied to a specific onboard workflow detail record."""
    result = _cf_call(api_client.get_onboard_users, workflow_on_board_details_id=details_id)
    return {"status": "success", "data": result}


# ---- Generic /{workflow_id} routes AFTER all sub-resource routes ----------

@app.get("/workflows/{workflow_id}", tags=["Workflows"])
async def get_workflow(workflow_id: str):
    """Get full details for a specific workflow."""
    result = _cf_call(api_client.get_workflow_details, workflow_id=workflow_id)
    return {"status": "success", "data": result}


@app.post("/workflows/{workflow_id}/run", tags=["Workflows"])
async def run_workflow(workflow_id: str):
    """
    Execute a created workflow. This is the 'Run Workflow' button action.
    Triggers the CloudFuze backend to provision users in the target SaaS apps.
    """
    result = _cf_call(api_client.run_workflow, workflow_id=workflow_id)
    logger.info("workflow | action=run | workflowId=%s", workflow_id)
    return {"status": "success", "workflow_id": workflow_id, "data": result}


@app.delete("/workflows/{workflow_id}", tags=["Workflows"])
async def delete_workflow(workflow_id: str):
    """Delete a workflow permanently."""
    result = _cf_call(api_client.delete_workflow, workflow_id=workflow_id)
    logger.info("workflow | action=delete | workflowId=%s", workflow_id)
    return {"status": "success", "data": result}


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.AGENT_PORT,
        reload=True,
    )
