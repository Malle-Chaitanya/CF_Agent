"""Tool: delete_user — offboard a user from a SaaS application."""

from __future__ import annotations

import json
import logging
from typing import Any

from pydantic import BaseModel, EmailStr, Field

from config import settings
from services.cloudfuze_api_client import api_client, CloudFuzeAPIError

logger = logging.getLogger(__name__)


class DeleteUserInput(BaseModel):
    email: EmailStr
    vendor: str = Field(..., min_length=1)
    admin_member_id: str = Field(..., min_length=1)
    perm_delete: bool = False


def handle_delete_user(arguments: dict[str, Any]) -> str:
    """Validate input, call the CloudFuze API, and return a human-readable result."""
    try:
        params = DeleteUserInput(**arguments)
    except Exception as exc:
        return json.dumps({"error": f"Invalid parameters: {exc}"})

    if settings.DEBUG:
        logger.debug(
            "[DEBUG] Tool=delete_user | Params=%s | Endpoint=POST /api/user/offBoard/runFlow",
            params.model_dump(),
        )

    try:
        result = api_client.delete_user(
            email=params.email,
            vendor=params.vendor,
            admin_member_id=params.admin_member_id,
            perm_delete=params.perm_delete,
        )
        return json.dumps({"status": "success", "data": result})
    except CloudFuzeAPIError as exc:
        return json.dumps({"error": exc.detail, "status_code": exc.status_code})
    except Exception as exc:
        logger.exception("Unexpected error in delete_user")
        return json.dumps({"error": str(exc)})
