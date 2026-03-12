"""Tool: get_onboard_users — retrieve users associated with an onboard workflow detail record."""

from __future__ import annotations

import json
import logging
from typing import Any

from config import settings
from services.cloudfuze_api_client import api_client, CloudFuzeAPIError

logger = logging.getLogger(__name__)


def handle_get_onboard_users(arguments: dict[str, Any]) -> str:
    logger.info("get_onboard_users raw arguments: %s", arguments)

    details_id = str(arguments.get("workflow_on_board_details_id", "")).strip()
    if not details_id:
        return json.dumps({"error": "Missing required parameter: 'workflow_on_board_details_id'"})

    if settings.DEBUG:
        logger.debug("[DEBUG] Tool=get_onboard_users | details_id=%s", details_id)

    try:
        result = api_client.get_onboard_users(workflow_on_board_details_id=details_id)
        return json.dumps({"status": "success", "data": result})
    except CloudFuzeAPIError as exc:
        logger.error("get_onboard_users API error %s: %s", exc.status_code, exc.detail)
        return json.dumps({"error": exc.detail, "status_code": exc.status_code})
    except Exception as exc:
        logger.exception("Unexpected error in get_onboard_users")
        return json.dumps({"error": str(exc)})
