"""Tool: create_conditional_workflow — create an automation workflow based on a condition."""

from __future__ import annotations

import json
import logging
from typing import Any

from config import settings
from services.cloudfuze_api_client import api_client, CloudFuzeAPIError
from tools.vendor_utils import normalize_vendor as _normalize_vendor

logger = logging.getLogger(__name__)


def handle_create_conditional_workflow(arguments: dict[str, Any]) -> str:
    logger.info("create_conditional_workflow raw arguments: %s", arguments)

    vendor = _normalize_vendor(arguments.get("vendor", ""))
    condition = arguments.get("condition", "").strip()
    workflow_name = arguments.get("workflow_name", "").strip()

    if not vendor:
        return json.dumps({"error": "Missing required parameter: 'vendor'"})
    if not condition:
        return json.dumps({"error": "Missing required parameter: 'condition'"})
    if not workflow_name:
        workflow_name = f"{vendor} - {condition.replace('_', ' ').title()}"

    if settings.DEBUG:
        logger.debug(
            "[DEBUG] Tool=create_conditional_workflow | workflow_name=%s | vendor=%s | condition=%s",
            workflow_name, vendor, condition,
        )

    try:
        result = api_client.create_conditional_workflow(
            workflow_name=workflow_name,
            vendor=vendor,
            condition=condition,
        )
        logger.info("workflow | type=conditional | vendor=%s | condition=%s", vendor, condition)
        return json.dumps({"status": "success", "data": result})
    except CloudFuzeAPIError as exc:
        logger.error("create_conditional_workflow API error %s: %s", exc.status_code, exc.detail)
        return json.dumps({"error": exc.detail, "status_code": exc.status_code})
    except Exception as exc:
        logger.exception("Unexpected error in create_conditional_workflow")
        return json.dumps({"error": str(exc)})
