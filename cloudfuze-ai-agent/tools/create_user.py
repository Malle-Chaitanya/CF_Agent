"""Tool: create_user — onboard a user to a SaaS application."""

from __future__ import annotations

import json
import logging
from typing import Any

from pydantic import BaseModel, EmailStr, Field

from config import settings
from services.cloudfuze_api_client import api_client, CloudFuzeAPIError

logger = logging.getLogger(__name__)


class CreateUserInput(BaseModel):
    email: EmailStr
    vendor: str = Field(..., min_length=1)
    admin_member_id: str = Field(..., min_length=1)
    role: str = "user"
    name: str = ""
    password: str = ""


def handle_create_user(arguments: dict[str, Any]) -> str:
    """Validate input, call the CloudFuze API, and return a human-readable result."""
    try:
        params = CreateUserInput(**arguments)
    except Exception as exc:
        return json.dumps({"error": f"Invalid parameters: {exc}"})

    if settings.DEBUG:
        logger.debug(
            "[DEBUG] Tool=create_user | Params=%s | Endpoint=POST /api/user/onBoard/runFlow",
            params.model_dump(),
        )

    try:
        result = api_client.create_user(
            email=params.email,
            vendor=params.vendor,
            admin_member_id=params.admin_member_id,
            role=params.role,
            name=params.name,
            password=params.password,
        )
        return json.dumps({"status": "success", "data": result})
    except CloudFuzeAPIError as exc:
        return json.dumps({"error": exc.detail, "status_code": exc.status_code})
    except Exception as exc:
        logger.exception("Unexpected error in create_user")
        return json.dumps({"error": str(exc)})
