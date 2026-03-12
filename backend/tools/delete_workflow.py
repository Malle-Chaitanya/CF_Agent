"""Tool: delete_workflow — permanently delete a workflow by ID."""

from __future__ import annotations

import json
import logging
from typing import Any

from config import settings
from services.cloudfuze_api_client import api_client, CloudFuzeAPIError

logger = logging.getLogger(__name__)


def handle_delete_workflow(arguments: dict[str, Any]) -> str:
    logger.info("delete_workflow raw arguments: %s", arguments)

    workflow_id = str(arguments.get("workflow_id", "")).strip()
    if not workflow_id:
        return json.dumps({"error": "Missing required parameter: 'workflow_id'"})

    if settings.DEBUG:
        logger.debug("[DEBUG] Tool=delete_workflow | workflow_id=%s", workflow_id)

    try:
        result = api_client.delete_workflow(workflow_id=workflow_id)
        logger.info("workflow | type=delete | workflowId=%s", workflow_id)
        return json.dumps({"status": "success", "data": result})
    except CloudFuzeAPIError as exc:
        logger.error("delete_workflow API error %s: %s", exc.status_code, exc.detail)
        return json.dumps({"error": exc.detail, "status_code": exc.status_code})
    except Exception as exc:
        logger.exception("Unexpected error in delete_workflow")
        return json.dumps({"error": str(exc)})
