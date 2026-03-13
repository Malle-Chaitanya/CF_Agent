"""Tool: run_workflow — execute an onboard or offboard workflow.

JAVA SOURCE ANALYSIS — users/runFlow (POST /api/user/onBoard/users/runFlow):
=============================================================================

Java does these lookups IN ORDER:

1. findVendorByMemberIdAndPlatformUserId(adminMemberId, userId, vendor)
   → Finds the TARGET vendor by SaaSVendor.memberId
   → Gets storedVendor.domainName (Java appends this to email itself)

2. if existingUser=true:
   findUserByAdminCloudIdAndEmailIdAndDeletedFalse(existingAdminCloudId, displayName)
   → Queries SaaSUser.emailId field (NOT SaaSUser.email — two different fields)
   → displayName must exactly match SaaSUser.emailId stored in DB
   → If found → existingUser object used for firstName/lastName

3. findOneByEmail(email + "@" + storedVendor.domainName, userId, memberId, vendor)
   → Checks if user already exists in TARGET vendor (skip if already onboarded)

4. if existingUser found (step 2): use it directly → proceed to createAUSer()
   if existingUser NOT found: findCreatedByEmail(email.split("@")[0], true)
   → Fallback: queries SaaSUser.email by username-only, created=true
   → This is the pre-registration path

5. Returns "User Not Exists In DB" ONLY if BOTH step 2 AND step 4 return null.

CONCLUSION:
- No extra GET to /api/vendor/list needed — Java fetches domain from storedVendor itself.
- displayName should be the full email AS STORED in SaaSUser.emailId.
- Fallback path (findCreatedByEmail) uses username-only from onBoardUser.email.
- We send BOTH: username as email, full email as displayName — covers both paths.

FIELD RULES:
  email           = username only (Java appends @domain from storedVendor.domainName)
  displayName     = full email as stored in SaaSUser.emailId (covers existingUser path)
  adminMemberId   = TARGET vendor SaaSVendor.memberId (UUID)
  adminCloudId    = TARGET vendor MongoDB _id (24-char hex)
  existingAdminCloudId = SOURCE vendor adminCloudId (where user's record lives in DB)

OFFBOARD (POST /api/user/offBoard/runFlow):
  adminMemberId = adminCloudId (MongoDB _id) — Java calls getSaaSVendorById → findById
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

    # existing_admin_cloud_id: adminCloudId of the SOURCE vendor (e.g. Microsoft 365)
    # where this user's record exists in CloudFuze DB (SaaSUser.emailId).
    # Java uses: findUserByAdminCloudIdAndEmailIdAndDeletedFalse(existingAdminCloudId, displayName)
    existing_admin_cloud_id = str(arguments.get("existing_admin_cloud_id") or "").strip()
    if not existing_admin_cloud_id:
        existing_admin_cloud_id = admin_cloud_id

    missing = [f for f, v in [
        ("email", email),
        ("vendor", vendor),
        ("admin_cloud_id", admin_cloud_id),
        ("admin_member_id", admin_member_id),
    ] if not v]

    if missing:
        return json.dumps({
            "error": "missing_required_fields",
            "missing": missing,
            "message": (
                f"Cannot run workflow — missing: {', '.join(missing)}. "
                "These come from the create_onboard_workflow response."
            ),
        })

    if settings.DEBUG:
        logger.debug(
            "[DEBUG] run_workflow | type=%s | email=%s | vendor=%s | "
            "adminCloudId=%s | adminMemberId=%s | existingAdminCloudId=%s",
            workflow_type, email, vendor,
            admin_cloud_id, admin_member_id, existing_admin_cloud_id,
        )

    try:
        if workflow_type == "offboard":
            # OFFBOARD: Java getSaaSVendorById(adminMemberId) → findById → needs MongoDB _id
            result = api_client.run_offboard_workflow(
                admin_cloud_id=admin_cloud_id,
                email=email,
                vendor=vendor,
                admin_member_id=admin_cloud_id,  # offboard needs adminCloudId, not memberId
                perm_delete=perm_delete,
            )
            action = "offboard"

        else:
            # ONBOARD: POST /api/user/onBoard/users/runFlow
            #
            # Java lookup chain (from source):
            # 1. findUserByAdminCloudIdAndEmailIdAndDeletedFalse(existingAdminCloudId, displayName)
            #    → displayName must match SaaSUser.emailId exactly
            # 2. Fallback: findCreatedByEmail(username, true)
            #    → matches SaaSUser.email by username-only
            #
            # We send:
            #   email        = username only (Java appends @domain from storedVendor itself)
            #   displayName  = full email (covers path 1 — SaaSUser.emailId lookup)
            #
            # No extra GET to /api/vendor/list needed here — Java handles domain internally.

            username = email.split("@")[0]
            display_name = email  # full email for SaaSUser.emailId lookup

            logger.info(
                "run_workflow | onboard | username=%s | displayName=%s | vendor=%s | "
                "adminMemberId=%s | existingAdminCloudId=%s",
                username, display_name, vendor, admin_member_id, existing_admin_cloud_id,
            )

            result = api_client.run_onboard_workflow(
                admin_cloud_id=admin_cloud_id,
                email=email,
                vendor=vendor,
                admin_member_id=admin_member_id,
                existing_admin_cloud_id=existing_admin_cloud_id,
                display_name=display_name,
            )
            action = "onboard"

        logger.info(
            "run_workflow | action=%s | email=%s | vendor=%s | result=%s",
            action, email, vendor, result,
        )

        # Check for Java-level error embedded in 200 OK response
        # Java returns 200 with created=false + errorMsg when provisioning fails
        if isinstance(result, list) and result:
            error_msg = result[0].get("errorMsg")
            created   = result[0].get("created", False)

            if error_msg and not created:
                logger.warning(
                    "run_workflow | vendor-level error | email=%s | vendor=%s | error=%s",
                    email, vendor, error_msg,
                )
                return json.dumps({
                    "status": "vendor_error",
                    "error": error_msg,
                    "email": email,
                    "vendor": vendor,
                    "message": (
                        f"The workflow request reached the server but the vendor connector "
                        f"reported: '{error_msg}'. "
                        "This is a server-side issue — check Java backend logs. "
                        "The user may not be synced into CloudFuze's database yet."
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
