"""Tool: approve_offboard_workflow — approve or reject a pending offboard workflow.

Offboard execution is gated by approval. This tool drives the PUT update
that transitions the workflow out of the pending state and into execution.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from config import settings
from services.cloudfuze_api_client import api_client, CloudFuzeAPIError

logger = logging.getLogger(__name__)

_VALID_STATUSES = {"APPROVED", "REJECTED"}


def handle_approve_offboard_workflow(arguments: dict[str, Any]) -> str:
    logger.info("approve_offboard_workflow raw arguments: %s", arguments)

    workflow_id = str(arguments.get("workflow_id", "")).strip()
    approve_status = str(arguments.get("approve_status", "")).strip().upper()

    if not workflow_id:
        return json.dumps({"error": "Missing required parameter: 'workflow_id'"})
    if approve_status not in _VALID_STATUSES:
        return json.dumps({
            "error": f"Invalid 'approve_status': '{approve_status}'. Must be APPROVED or REJECTED."
        })

    if settings.DEBUG:
        logger.debug(
            "[DEBUG] Tool=approve_offboard_workflow | workflow_id=%s | status=%s",
            workflow_id, approve_status,
        )

    try:
        result = api_client.approve_offboard_workflow(
            workflow_id=workflow_id,
            approve_status=approve_status,
        )
        logger.info("workflow | type=offboard_approve | workflowId=%s | status=%s", workflow_id, approve_status)
        return json.dumps({"status": "success", "data": result})
    except CloudFuzeAPIError as exc:
        logger.error("approve_offboard_workflow API error %s: %s", exc.status_code, exc.detail)
        return json.dumps({"error": exc.detail, "status_code": exc.status_code})
    except Exception as exc:
        logger.exception("Unexpected error in approve_offboard_workflow")
        return json.dumps({"error": str(exc)})
