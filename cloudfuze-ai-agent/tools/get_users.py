"""Tool: get_users — list users from a SaaS application."""

from __future__ import annotations

import json
import logging
from typing import Any

from pydantic import BaseModel, Field

from config import settings
from services.cloudfuze_api_client import api_client, CloudFuzeAPIError

logger = logging.getLogger(__name__)


class GetUsersInput(BaseModel):
    admin_member_id: str = Field(..., min_length=1)
    vendor: str = ""
    role: str = ""
    active_status: str = ""
    page: int = 0
    size: int = 20


def handle_get_users(arguments: dict[str, Any]) -> str:
    """Validate input, call the CloudFuze API, and return a human-readable result."""
    try:
        params = GetUsersInput(**arguments)
    except Exception as exc:
        return json.dumps({"error": f"Invalid parameters: {exc}"})

    if settings.DEBUG:
        logger.debug(
            "[DEBUG] Tool=get_users | Params=%s | Endpoint=GET /api/user/%s/users",
            params.model_dump(),
            params.admin_member_id,
        )

    try:
        result = api_client.get_users(
            admin_member_id=params.admin_member_id,
            vendor=params.vendor,
            role=params.role,
            active_status=params.active_status,
            page=params.page,
            size=params.size,
        )
        return json.dumps({"status": "success", "data": result})
    except CloudFuzeAPIError as exc:
        return json.dumps({"error": exc.detail, "status_code": exc.status_code})
    except Exception as exc:
        logger.exception("Unexpected error in get_users")
        return json.dumps({"error": str(exc)})
