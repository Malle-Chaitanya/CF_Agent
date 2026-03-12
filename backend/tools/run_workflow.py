"""Tool: run_workflow — execute an onboard or offboard workflow.

CRITICAL field difference between onboard and offboard (from Java source):

ONBOARD  (POST /api/user/onBoard/users/runFlow):
  - admin_member_id  = TARGET vendor SaaSVendor.memberId (UUID like 4fa61aa7-...)
  - admin_cloud_id   = TARGET vendor MongoDB _id (24-char hex)
  - existing_admin_cloud_id = SOURCE vendor (M365) adminCloudId — MUST match user's email domain
  - email passed as FULL email e.g. chaitanya.malle@cloudfuze.com
    → api_client strips to username, appends @domain for displayName/existingMemberId

OFFBOARD (POST /api/user/offBoard/runFlow):
  - admin_member_id = adminCloudId (MongoDB _id) — Java calls getSaaSVendorById → findById
"""

from __future__ import annotations
import json
import logging
from typing import Any

from config import settings
from services.cloudfuze_api_client import api_client, CloudFuzeAPIError

logger = logging.getLogger(__name__)


def handle_run_workflow(arguments: dict[str, Any]) -> str:
    logger.info("run_workflow args: %s", arguments)

    workflow_type = str(arguments.get("workflow_type") or "onboard").lower().strip()
    email         = str(arguments.get("email") or "").strip()
    vendor        = str(arguments.get("vendor") or "").strip()
    admin_cloud_id  = str(arguments.get("admin_cloud_id") or "").strip()
    admin_member_id = str(arguments.get("admin_member_id") or "").strip()
    perm_delete     = bool(arguments.get("perm_delete", False))
    existing_admin_cloud_id = str(arguments.get("existing_admin_cloud_id") or "").strip()

    missing = [f for f, v in [("email", email), ("vendor", vendor),
                               ("admin_cloud_id", admin_cloud_id),
                               ("admin_member_id", admin_member_id)] if not v]
    if missing:
        return json.dumps({
            "error": "missing_required_fields",
            "missing": missing,
            "message": f"Cannot run workflow — missing: {', '.join(missing)}.",
        })

    if settings.DEBUG:
        logger.debug(
            "[DEBUG] run_workflow | type=%s | email=%s | vendor=%s | "
            "adminCloudId=%s | adminMemberId=%s | existingAdminCloudId=%s",
            workflow_type, email, vendor, admin_cloud_id, admin_member_id, existing_admin_cloud_id,
        )

    try:
        if workflow_type == "offboard":
            result = api_client.run_offboard_workflow(
                admin_cloud_id=admin_cloud_id,
                email=email,
                vendor=vendor,
                admin_member_id=admin_cloud_id,  # offboard needs MongoDB _id
                perm_delete=perm_delete,
            )
            action = "offboard"
        else:
            # Pass the full email (e.g. chaitanya.malle@cloudfuze.com) so the api_client
            # can extract the domain and match the correct M365 tenant.
            # existing_admin_cloud_id is a hint but api_client will re-verify via vendor list.
            result = api_client.run_onboard_workflow(
                admin_cloud_id=admin_cloud_id,
                email=email,
                vendor=vendor,
                admin_member_id=admin_member_id,
                existing_admin_cloud_id=existing_admin_cloud_id,
            )
            action = "onboard"

        logger.info("workflow | action=%s | email=%s | vendor=%s | result=%s",
                    action, email, vendor, result)

        # Check for Java-level error in 200 OK response
        if isinstance(result, list) and result:
            error_msg = result[0].get("errorMsg")
            created   = result[0].get("created", False)
            if error_msg and not created:
                logger.warning("run_workflow | vendor error | email=%s | vendor=%s | error=%s",
                               email, vendor, error_msg)
                return json.dumps({
                    "status": "vendor_error",
                    "error": error_msg,
                    "email": email,
                    "vendor": vendor,
                    "message": (
                        f"The workflow was sent but the vendor reported: {error_msg}. "
                        "Check Java backend logs or try a different vendor."
                    ),
                })

        return json.dumps({
            "status": "success",
            "action": action,
            "email": email,
            "vendor": vendor,
            "message": f"Successfully ran {action} workflow for {email} on {vendor}.",
            "data": result,
        })

    except CloudFuzeAPIError as exc:
        logger.error("run_workflow API error %s: %s", exc.status_code, exc.detail)
        return json.dumps({"error": exc.detail, "status_code": exc.status_code})
    except Exception as exc:
        logger.exception("Unexpected error in run_workflow")
        return json.dumps({"error": str(exc)})
