"""Tool: get_user_apps — list all SaaS apps a user belongs to."""

from __future__ import annotations

import json
import logging
from typing import Any

from pydantic import BaseModel, EmailStr

from config import settings
from services.cloudfuze_api_client import api_client, CloudFuzeAPIError

logger = logging.getLogger(__name__)


class GetUserAppsInput(BaseModel):
    email: EmailStr


def handle_get_user_apps(arguments: dict[str, Any]) -> str:
    """Validate input, call the CloudFuze API, and return a human-readable result."""
    try:
        params = GetUserAppsInput(**arguments)
    except Exception as exc:
        return json.dumps({"error": f"Invalid parameters: {exc}"})

    if settings.DEBUG:
        logger.debug(
            "[DEBUG] Tool=get_user_apps | Params=%s | Endpoint=GET /api/user/users/apps/%s",
            params.model_dump(),
            params.email,
        )

    try:
        result = api_client.get_user_apps(email=params.email)
        return json.dumps({"status": "success", "data": result})
    except CloudFuzeAPIError as exc:
        return json.dumps({"error": exc.detail, "status_code": exc.status_code})
    except Exception as exc:
        logger.exception("Unexpected error in get_user_apps")
        return json.dumps({"error": str(exc)})
