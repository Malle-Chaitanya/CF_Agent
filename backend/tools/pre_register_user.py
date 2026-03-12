"""Tool: pre_register_user — pre-register a user in CloudFuze DB before running onboard workflow.

The Java backend requires users to exist in SaaSUser collection with created=true
before POST /api/user/onBoard/runFlow can provision them into the SaaS app.

Endpoint: POST /api/user/onBoard
Body: array of user objects with email (username part only), vendor, adminMemberId.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from services.cloudfuze_api_client import api_client, CloudFuzeAPIError

logger = logging.getLogger(__name__)


def handle_pre_register_user(arguments: dict[str, Any]) -> str:
    logger.info("pre_register_user args: %s", arguments)

    email = str(arguments.get("email") or "").strip()
    vendor = str(arguments.get("vendor") or "").strip()
    admin_member_id = str(arguments.get("admin_member_id") or "").strip()
    first_name = str(arguments.get("first_name") or "").strip()
    last_name = str(arguments.get("last_name") or "").strip()

    missing = []
    if not email:
        missing.append("email")
    if not vendor:
        missing.append("vendor")
    if not admin_member_id:
        missing.append("admin_member_id")

    if missing:
        return json.dumps({
            "error": "missing_required_fields",
            "missing": missing,
            "message": (
                f"Cannot pre-register user — missing: {', '.join(missing)}. "
                "Use get_connected_vendors to get admin_member_id (SaaSVendor.memberId)."
            ),
        })

    try:
        result = api_client.pre_register_user(
            email=email,
            vendor=vendor,
            admin_member_id=admin_member_id,
            first_name=first_name,
            last_name=last_name,
        )
        logger.info("pre_register_user | email=%s | vendor=%s | result=%s", email, vendor, result)
        return json.dumps({
            "status": "success",
            "message": f"User {email} pre-registered for {vendor}. Now call run_workflow to provision.",
            "email": email,
            "vendor": vendor,
            "admin_member_id": admin_member_id,
            "data": result,
        })
    except CloudFuzeAPIError as exc:
        logger.error("pre_register_user API error %s: %s", exc.status_code, exc.detail)
        return json.dumps({"error": exc.detail, "status_code": exc.status_code})
    except Exception as exc:
        logger.exception("Unexpected error in pre_register_user")
        return json.dumps({"error": str(exc)})
