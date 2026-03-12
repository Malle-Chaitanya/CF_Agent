"""Tool: create_onboard_workflow — build an onboarding workflow.

Calls GET /api/vendor/list to resolve vendor name → adminCloudId + memberId,
then POST /api/workflow/onboard/create.

Returns all fields needed by run_workflow:
  admin_cloud_id, admin_member_id, existing_admin_cloud_id, email, vendor
"""

from __future__ import annotations
import json
import logging
from typing import Any

from config import settings
from services.cloudfuze_api_client import api_client, CloudFuzeAPIError
from tools.vendor_utils import normalize_vendor, normalize_users

logger = logging.getLogger(__name__)

# Identity providers in priority order — these are the source vendors where users
# exist in CloudFuze DB. Their adminCloudId becomes existingAdminCloudId in runFlow.
_SOURCE_PRIORITY = [
    "MICROSOFT_OFFICE_365", "MICROSOFT_365",
    "GOOGLE_WORKSPACE", "GSUITE",
    "OKTA", "AZURE_AD", "ONELOGIN", "JUMPCLOUD",
]


def _resolve_connected_vendors() -> list[dict]:
    result = api_client.get_connected_vendors()
    vendors = result if isinstance(result, list) else (result.get("data") or result.get("vendors") or [])
    out = []
    for v in (vendors if isinstance(vendors, list) else []):
        if not isinstance(v, dict):
            continue
        out.append({
            "adminCloudId": str(v.get("id") or v.get("adminCloudId") or ""),
            "memberId":     str(v.get("memberId") or v.get("memebId") or ""),
            "providerName": (v.get("providerName") or v.get("vendorName") or "").strip().upper().replace(" ", "_"),
            "adminEmail":   str(v.get("adminEmail") or ""),
            "domainName":   str(v.get("domainName") or ""),
        })
    return out


def _find_source_vendor(connected: list[dict], user_email: str = "") -> dict | None:
    """Return the primary identity-provider vendor (source of truth for user records).

    IMPORTANT: Do NOT match by email domain. The existingAdminCloudId is determined by
    which IDP tenant users were IMPORTED FROM in CloudFuze DB — not their email domain.
    Confirmed by terminal test: chaitanya.malle@cloudfuze.com succeeds with
    existingAdminCloudId=69b28f4d4907036fee79b701 (the filefuze.co M365 tenant).

    Always use the first IDP found by priority order.
    """
    # Strict priority match — return first found
    for priority in _SOURCE_PRIORITY:
        for v in connected:
            p = (v.get("providerName") or "").upper().replace(" ", "_")
            if p == priority and v.get("adminCloudId"):
                return v

    # Partial match
    for priority in _SOURCE_PRIORITY:
        for v in connected:
            p = (v.get("providerName") or "").upper().replace(" ", "_")
            if priority in p and v.get("adminCloudId"):
                return v

    # Fallback: any vendor with adminCloudId
    return next((v for v in connected if v.get("adminCloudId")), None)


def _run_payload(workflow_name, workflow_id, match, member_id, users, existing_admin_cloud_id=""):
    """Build the payload returned to the LLM — contains all fields run_workflow needs."""
    return {
        "workflow_name": workflow_name,
        "workflow_id": workflow_id,
        "email": users[0]["email"] if users else None,
        "vendor": match["providerName"],
        "admin_cloud_id": match["adminCloudId"],
        "admin_member_id": member_id,           # TARGET vendor memberId UUID
        "existing_admin_cloud_id": existing_admin_cloud_id or match["adminCloudId"],
    }


def handle_create_onboard_workflow(arguments: dict[str, Any]) -> str:
    logger.info("create_onboard_workflow args: %s", arguments)

    vendor_name = (arguments.get("vendor_name") or arguments.get("vendor") or "").strip()
    if not vendor_name:
        return json.dumps({"error": "missing_vendor",
                           "message": "Please provide the vendor name (e.g. TWILIO, SLACK)."})

    users = normalize_users(arguments.get("users"))
    if not users:
        return json.dumps({"error": "Missing or invalid 'users'. Provide [{\"email\": \"user@company.com\"}]"})

    workflow_name = (arguments.get("workflow_name")
                     or f"{normalize_vendor(vendor_name)} Onboarding - {users[0]['email']}")

    # Resolve connected vendors
    connected_raw = arguments.get("connected_vendors")
    if connected_raw and isinstance(connected_raw, list) and connected_raw:
        connected = []
        for v in connected_raw:
            if isinstance(v, dict) and (v.get("adminCloudId") or v.get("id")):
                connected.append({
                    "adminCloudId": str(v.get("adminCloudId") or v.get("id")),
                    "memberId":     str(v.get("memberId") or ""),
                    "providerName": (v.get("providerName") or "").strip().upper().replace(" ", "_"),
                    "adminEmail":   str(v.get("adminEmail") or ""),
                    "domainName":   str(v.get("domainName") or ""),
                })
    else:
        try:
            connected = _resolve_connected_vendors()
        except CloudFuzeAPIError as exc:
            return json.dumps({"error": "could_not_fetch_connected_vendors", "detail": exc.detail})

    # Find target vendor
    vendor_normalized = normalize_vendor(vendor_name)
    match = None
    for c in connected:
        if not c.get("adminCloudId"):
            continue
        p = (c.get("providerName") or "").strip().upper().replace(" ", "_")
        if p == vendor_normalized or vendor_normalized in p or p in vendor_normalized:
            match = c
            break

    if not match:
        return json.dumps({
            "error": "vendor_not_connected",
            "message": f"'{vendor_name}' is not connected. Call get_connected_vendors to see connected apps.",
            "connected_providers": [c.get("providerName") for c in connected if c.get("providerName")],
        })

    member_id = match.get("memberId") or ""
    if not member_id:
        return json.dumps({"error": "missing_member_id",
                           "message": "Vendor has no memberId. Reconnect the app in CloudFuze."})

    # Find source vendor — pass user email so domain matching works for multi-tenant M365
    user_email = users[0]["email"] if users else ""
    source_vendor = _find_source_vendor(connected, user_email)
    existing_admin_cloud_id = (
        source_vendor["adminCloudId"]
        if source_vendor and source_vendor["adminCloudId"] != match["adminCloudId"]
        else match["adminCloudId"]
    )
    logger.info("create_onboard_workflow | source_vendor=%s | existing_admin_cloud_id=%s",
                source_vendor.get("providerName") if source_vendor else "none",
                existing_admin_cloud_id)

    body = {
        "workFlowName": workflow_name,
        "workFlowLists": [{
            "providerName": match["providerName"] or vendor_normalized,
            "adminCloudId": match["adminCloudId"],
            "adminEmail":   match["adminEmail"],
            "domainName":   match["domainName"],
        }],
        "users": users,
    }

    if settings.DEBUG:
        logger.debug("[DEBUG] create_onboard_workflow | name=%s | vendor=%s | memberId=%s",
                     workflow_name, vendor_normalized, member_id)

    try:
        result = api_client.create_onboard_workflow_v2(body)
        workflow_id = None
        if isinstance(result, dict):
            workflow_id = (result.get("workFlowId") or result.get("id")
                           or result.get("workflowId") or result.get("_id"))

        return json.dumps({
            "status": "success",
            "workflow_type": "onboard",
            "message": "Workflow created successfully. Ready to run.",
            **_run_payload(workflow_name, workflow_id, match, member_id, users, existing_admin_cloud_id),
            "data": result,
        })

    except CloudFuzeAPIError as exc:
        if exc.status_code == 400 and exc.detail and (
            "same name already exists" in exc.detail
            or "already exists" in exc.detail
            or "duplicate" in exc.detail.lower()
        ):
            logger.info("workflow | duplicate name | reusing vendor match | vendor=%s | memberId=%s",
                        vendor_normalized, member_id)
            return json.dumps({
                "status": "exists",
                "workflow_type": "onboard",
                "message": (
                    "A workflow for this user and vendor already exists. "
                    "Proceeding to run it. admin_member_id is the vendor memberId — NOT workFlowId."
                ),
                **_run_payload(workflow_name, None, match, member_id, users, existing_admin_cloud_id),
            })

        logger.error("create_onboard_workflow API error %s: %s", exc.status_code, exc.detail)
        return json.dumps({"error": exc.detail, "status_code": exc.status_code})

    except Exception as exc:
        logger.exception("Unexpected error in create_onboard_workflow")
        return json.dumps({"error": str(exc)})
