"""Tool: get_workflow_details — fetch full details for a specific workflow by ID."""

from __future__ import annotations

import json
import logging
from typing import Any

from config import settings
from services.cloudfuze_api_client import api_client, CloudFuzeAPIError

logger = logging.getLogger(__name__)


def handle_get_workflow_details(arguments: dict[str, Any]) -> str:
    logger.info("get_workflow_details raw arguments: %s", arguments)

    workflow_id = str(arguments.get("workflow_id", "")).strip()
    if not workflow_id:
        return json.dumps({"error": "Missing required parameter: 'workflow_id'"})

    if settings.DEBUG:
        logger.debug("[DEBUG] Tool=get_workflow_details | workflow_id=%s", workflow_id)

    try:
        result = api_client.get_workflow_details(workflow_id=workflow_id)
        return json.dumps({"status": "success", "data": result})
    except CloudFuzeAPIError as exc:
        logger.error("get_workflow_details API error %s: %s", exc.status_code, exc.detail)
        return json.dumps({"error": exc.detail, "status_code": exc.status_code})
    except Exception as exc:
        logger.exception("Unexpected error in get_workflow_details")
        return json.dumps({"error": str(exc)})
