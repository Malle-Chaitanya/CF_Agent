"""Tool: get_connected_vendors — list all SaaS apps connected to this CloudFuze account.

This is a prerequisite for create_onboard_workflow. The Java backend requires
adminCloudId (the DB id of the connected SaaSVendor) when creating workflows.
Call this first to resolve a vendor name to its adminCloudId before onboarding.

NOTE: The Java API has a typo in the vendor list response — the member ID field
is "memebId" (not "memberId"). We read both to be safe.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from config import settings
from services.cloudfuze_api_client import api_client, CloudFuzeAPIError

logger = logging.getLogger(__name__)


def handle_get_connected_vendors(arguments: dict[str, Any]) -> str:
    if settings.DEBUG:
        logger.debug("[DEBUG] get_connected_vendors | Endpoint=GET /api/vendor/list")

    try:
        result = api_client.get_connected_vendors()
        vendors = result if isinstance(result, list) else result.get("data", result)
        if not isinstance(vendors, list):
            vendors = result.get("vendors", []) if isinstance(result, dict) else []

        simplified = []
        seen_provider_names: set[str] = set()
        for v in vendors:
            if not isinstance(v, dict):
                continue
            # Java API has a typo: field is "memebId" not "memberId"
            # Read both keys so we work regardless of whether it gets fixed upstream
            member_id = v.get("memebId") or v.get("memberId") or ""
            provider_name = (v.get("providerName") or v.get("vendorName") or "").strip()
            if not provider_name:
                continue
            key = provider_name.upper()
            if key in seen_provider_names:
                continue
            seen_provider_names.add(key)
            simplified.append({
                "adminCloudId": v.get("id") or v.get("adminCloudId", ""),
                "memberId": member_id,
                "providerName": provider_name,
                "adminEmail": v.get("adminEmail", ""),
                "domainName": v.get("domainName", ""),
                "status": str(v.get("status", "")),
            })

        return json.dumps({"status": "success", "vendors": simplified})
    except CloudFuzeAPIError as exc:
        logger.error("get_connected_vendors API error %s: %s", exc.status_code, exc.detail)
        return json.dumps({"error": exc.detail, "status_code": exc.status_code})
    except Exception as exc:
        logger.exception("Unexpected error in get_connected_vendors")
        return json.dumps({"error": str(exc)})