"""Tool: get_offboard_details — fetch offboard workflow details by workflow ID.

Root cause of the original 401:
  GET /api/workflow/offboarddetails requires ?workflowId=... as a query param.
  Calling it without the param causes Spring to throw MissingServletRequestParameterException,
  which the security filter incorrectly surfaces as a 401 instead of 400.

Fix: always use GET /api/workflow/get/offboarddetails/{workFlowId} when listing
offboard details — it takes userId from JWT (no extra param needed beyond the path).
For fetching a single detail record, pass workflowId explicitly.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from config import settings
from services.cloudfuze_api_client import api_client, CloudFuzeAPIError

logger = logging.getLogger(__name__)


def handle_get_offboard_details(arguments: dict[str, Any]) -> str:
    workflow_id = str(arguments.get("workflow_id", "")).strip()

    if not workflow_id:
        return json.dumps({
            "error": "missing_workflow_id",
            "message": (
                "Please provide the workflow ID to fetch offboard details. "
                "You can get workflow IDs by calling list_workflows first."
            )
        })

    if settings.DEBUG:
        logger.debug(
            "[DEBUG] get_offboard_details | workflow_id=%s | "
            "Endpoint=GET /api/workflow/get/offboarddetails/%s",
            workflow_id, workflow_id,
        )

    try:
        # Use the correct endpoint: /get/offboarddetails/{workFlowId}
        # This uses userId from JWT automatically — no extra auth needed.
        result = api_client.get_offboard_details_by_workflow(workflow_id=workflow_id)
        return json.dumps({"status": "success", "data": result})
    except CloudFuzeAPIError as exc:
        logger.error("get_offboard_details API error %s: %s", exc.status_code, exc.detail)
        if exc.status_code == 401:
            return json.dumps({
                "error": "auth_error",
                "message": (
                    "Authorization failed fetching offboard details. "
                    "Verify the workflow ID is correct and your token has the required permissions."
                )
            })
        return json.dumps({"error": exc.detail, "status_code": exc.status_code})
    except Exception as exc:
        logger.exception("Unexpected error in get_offboard_details")
        return json.dumps({"error": str(exc)})
