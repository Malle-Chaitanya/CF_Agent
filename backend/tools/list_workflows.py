"""Tool: list_workflows — retrieve all workflows for the authenticated admin."""

from __future__ import annotations

import json
import logging
from typing import Any

from config import settings
from services.cloudfuze_api_client import api_client, CloudFuzeAPIError

logger = logging.getLogger(__name__)


def handle_list_workflows(arguments: dict[str, Any]) -> str:
    if settings.DEBUG:
        logger.debug(
            "[DEBUG] Tool=list_workflows | Endpoint=GET /api/workflow/get/workflows",
        )

    try:
        result = api_client.list_workflows()
        return json.dumps({"status": "success", "data": result})
    except CloudFuzeAPIError as exc:
        return json.dumps({"error": exc.detail, "status_code": exc.status_code})
    except Exception as exc:
        logger.exception("Unexpected error in list_workflows")
        return json.dumps({"error": str(exc)})
