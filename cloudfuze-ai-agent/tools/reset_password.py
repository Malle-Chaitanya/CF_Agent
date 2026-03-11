"""Tool: reset_password — reset a user's password in a SaaS application."""

from __future__ import annotations

import json
import logging
from typing import Any

from pydantic import BaseModel, EmailStr, Field

from config import settings
from services.cloudfuze_api_client import api_client, CloudFuzeAPIError

logger = logging.getLogger(__name__)


class ResetPasswordInput(BaseModel):
    email: EmailStr
    vendor: str = Field(..., min_length=1)
    admin_member_id: str = Field(..., min_length=1)


def handle_reset_password(arguments: dict[str, Any]) -> str:
    """Validate input, call the CloudFuze API, and return a human-readable result."""
    try:
        params = ResetPasswordInput(**arguments)
    except Exception as exc:
        return json.dumps({"error": f"Invalid parameters: {exc}"})

    if settings.DEBUG:
        logger.debug(
            "[DEBUG] Tool=reset_password | Params=%s | Endpoint=POST /api/user/offBoard/pwd",
            params.model_dump(),
        )

    try:
        result = api_client.reset_password(
            email=params.email,
            vendor=params.vendor,
            admin_member_id=params.admin_member_id,
        )
        return json.dumps({"status": "success", "data": result})
    except CloudFuzeAPIError as exc:
        return json.dumps({"error": exc.detail, "status_code": exc.status_code})
    except Exception as exc:
        logger.exception("Unexpected error in reset_password")
        return json.dumps({"error": str(exc)})
