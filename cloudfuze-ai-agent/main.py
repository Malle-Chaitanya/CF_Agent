"""CloudFuze AI Agent — FastAPI entry point.

Run with:
    python main.py
"""

from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field

from config import settings
from agents.user_management_agent import UserManagementAgent

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
    logger.info("CloudFuze AI Agent started (model=%s, debug=%s)", settings.OPENAI_MODEL, settings.DEBUG)
    logger.info("In your browser use: http://localhost:%s or http://127.0.0.1:%s (not 0.0.0.0)", settings.AGENT_PORT, settings.AGENT_PORT)
    yield
    logger.info("CloudFuze AI Agent shutting down.")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="CloudFuze AI Agent",
    description="AI assistant for managing SaaS users via the CloudFuze backend API.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
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
# Request / response models
# ---------------------------------------------------------------------------
class QueryRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="Natural-language admin prompt.")
    session_id: str = Field(
        default="",
        description="Optional session ID for conversation continuity. Auto-generated if omitted.",
    )


class QueryResponse(BaseModel):
    response: str
    session_id: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/", include_in_schema=False)
async def root():
    """Redirect to API docs. Use http://localhost:PORT in the browser (not 0.0.0.0)."""
    return RedirectResponse(url="/docs", status_code=302)


@app.get("/v1", include_in_schema=False)
@app.get("/v1/", include_in_schema=False)
async def v1_redirect():
    """Redirect /v1 to API docs. This is the CloudFuze AI Agent, not Weaviate."""
    return RedirectResponse(url="/docs", status_code=302)


@app.post("/agent/query", response_model=QueryResponse)
async def agent_query(request: QueryRequest):
    """Accept a natural-language prompt and return the agent's response."""
    session_id = request.session_id or str(uuid.uuid4())
    logger.info("Session=%s | Prompt=%s", session_id, request.prompt[:120])

    try:
        answer = agent.run(session_id=session_id, user_prompt=request.prompt)
    except Exception as exc:
        logger.exception("Agent error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return QueryResponse(response=answer, session_id=session_id)


@app.get("/health")
async def health():
    """Simple liveness probe."""
    return {"status": "ok", "service": "cloudfuze-ai-agent"}


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
