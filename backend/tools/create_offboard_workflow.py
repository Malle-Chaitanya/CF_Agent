"""Tool: create_offboard_workflow — trigger an offboarding workflow for one or more users.

Input normalization handles the various shapes GPT-4o may send for list fields:
  - apps: [{"vendor": "SLACK"}] | ["SLACK"] | "SLACK"
  - users: [{"email": "x@y.com"}] | ["x@y.com"] | "x@y.com"
  - workflow_name: auto-generated if omitted
"""

from __future__ import annotations

import json
import logging
from typing import Any

from config import settings
from services.cloudfuze_api_client import api_client, CloudFuzeAPIError
from tools.vendor_utils import normalize_vendor as _normalize_vendor, normalize_applications as _normalize_apps_util

logger = logging.getLogger(__name__)


def _normalize_apps(raw: Any) -> list[dict[str, str]] | None:
    return _normalize_apps_util(raw)


def _normalize_users(raw: Any) -> list[dict[str, str]] | None:
    from tools.vendor_utils import normalize_users
    return normalize_users(raw)


def handle_create_offboard_workflow(arguments: dict[str, Any]) -> str:
    logger.info("create_offboard_workflow raw arguments: %s", arguments)

    apps = _normalize_apps(arguments.get("apps"))
    if not apps:
        return json.dumps({
            "error": "Missing or invalid 'apps'. Expected list of vendors e.g. [{\"vendor\": \"SLACK\"}]"
        })

    users = _normalize_users(arguments.get("users"))
    if not users:
        return json.dumps({
            "error": "Missing or invalid 'users'. Expected list of emails e.g. [{\"email\": \"user@company.com\"}]"
        })

    workflow_name = arguments.get("workflow_name") or (
        f"{apps[0]['vendor']} Offboarding - {users[0]['email']}"
    )

    if settings.DEBUG:
        logger.debug(
            "[DEBUG] Tool=create_offboard_workflow | workflow_name=%s | apps=%s | users=%s",
            workflow_name, apps, users,
        )

    try:
        result = api_client.create_offboard_workflow(
            workflow_name=workflow_name,
            apps=apps,
            users=users,
        )
        logger.info("workflow | type=offboard | email=%s | apps=%s", users, apps)
        return json.dumps({"status": "success", "data": result})
    except CloudFuzeAPIError as exc:
        logger.error("create_offboard_workflow API error %s: %s", exc.status_code, exc.detail)
        return json.dumps({"error": exc.detail, "status_code": exc.status_code})
    except Exception as exc:
        logger.exception("Unexpected error in create_offboard_workflow")
        return json.dumps({"error": str(exc)})
