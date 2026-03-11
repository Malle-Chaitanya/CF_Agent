"""Tool: count_users — return the total number of managed users."""

from __future__ import annotations

import json
import logging
from typing import Any

from config import settings
from services.cloudfuze_api_client import api_client, CloudFuzeAPIError

logger = logging.getLogger(__name__)


def handle_count_users(arguments: dict[str, Any]) -> str:
    """No required parameters — just call the count endpoint."""
    if settings.DEBUG:
        logger.debug(
            "[DEBUG] Tool=count_users | Params=%s | Endpoint=GET /api/user/count",
            arguments,
        )

    try:
        result = api_client.count_users()
        return json.dumps({"status": "success", "data": result})
    except CloudFuzeAPIError as exc:
        return json.dumps({"error": exc.detail, "status_code": exc.status_code})
    except Exception as exc:
        logger.exception("Unexpected error in count_users")
        return json.dumps({"error": str(exc)})
