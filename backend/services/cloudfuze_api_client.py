"""HTTP client for the CloudFuze Java backend REST API."""

from __future__ import annotations
import logging
from typing import Any
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from config import settings

logger = logging.getLogger(__name__)


class CloudFuzeAPIError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"CloudFuze API error {status_code}: {detail}")


class CloudFuzeAPIClient:
    def __init__(self) -> None:
        self.base_url = settings.CLOUDFUZE_BASE_URL.rstrip("/")
        self.timeout = settings.API_REQUEST_TIMEOUT
        self.session = self._build_session()

    def _build_session(self) -> requests.Session:
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {settings.CLOUDFUZE_TOKEN}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        })
        retry_strategy = Retry(
            total=settings.API_MAX_RETRIES,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "POST", "PUT", "DELETE"],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        return session

    def _request(self, method, path, params=None, json_body=None):
        url = f"{self.base_url}{path}"
        logger.info("API %s %s params=%s body=%s", method, url, params, json_body)
        try:
            response = self.session.request(method, url, params=params, json=json_body,
                                            timeout=self.timeout, headers=self.session.headers)
        except requests.exceptions.ConnectionError as exc:
            raise CloudFuzeAPIError(0, f"Cannot reach CloudFuze backend at {url}") from exc
        except requests.exceptions.Timeout as exc:
            raise CloudFuzeAPIError(0, "Request to CloudFuze backend timed out") from exc
        except requests.exceptions.RequestException as exc:
            raise CloudFuzeAPIError(0, str(exc)) from exc

        if not response.ok:
            detail = response.text[:500]
            logger.error("API error %s: %s", response.status_code, detail)
            raise CloudFuzeAPIError(response.status_code, detail)
        if response.status_code == 204 or not response.content:
            return {"status": "success"}
        try:
            return response.json()
        except ValueError:
            return {"raw": response.text[:1000]}

    # ── Vendors ────────────────────────────────────────────────────────────

    def get_connected_vendors(self):
        return self._request("GET", "/api/vendor/list")

    # ── Onboard ────────────────────────────────────────────────────────────

    def create_onboard_workflow_v2(self, body):
        logger.info("workflow | type=onboard_v2 | body keys=%s", list(body.keys()))
        return self._request("POST", "/api/workflow/onboard/create", json_body=body)

    def pre_register_user(self, email, vendor, admin_member_id, first_name="", last_name=""):
        username = email.split("@")[0]
        body = [{
            "email": username,
            "vendor": vendor,
            "adminMemberId": admin_member_id,
            "firstName": first_name or username,
            "lastName": last_name or username,
            "role": "OTHER",
        }]
        logger.info("user | action=pre_register | email=%s | vendor=%s", email, vendor)
        return self._request("POST", "/api/user/onBoard", json_body=body)

    def run_onboard_workflow(self, admin_cloud_id, email, vendor, admin_member_id,
                             existing_admin_cloud_id=""):
        """POST /api/user/onBoard/users/runFlow

        CONFIRMED WORKING (terminal test chaitanya.malle@cloudfuze.com → TWILIO):
          email            = username only  e.g. "chaitanya.malle"
          displayName      = FULL email     e.g. "chaitanya.malle@cloudfuze.com"
          existingMemberId = FULL email     (Java findUserByAdminCloudIdAndEmail queries SaaSUser.emailId)
          existingAdminCloudId = adminCloudId of M365 tenant whose domainName = user's email domain

        MULTI-TENANT LOGIC:
          You may have multiple M365 tenants (e.g. cloudfuze.com + filefuze.co).
          We always fetch the vendor list live and match by email domain to get the right tenant.
        """
        _SOURCE_PRIORITY = [
            "MICROSOFT_OFFICE_365", "MICROSOFT_365",
            "GOOGLE_WORKSPACE", "GSUITE",
            "OKTA", "AZURE_AD", "ONELOGIN", "JUMPCLOUD",
        ]

        username = email.split("@")[0]
        email_domain = email.split("@")[1] if "@" in email else ""

        resolved_existing_admin_cloud_id = existing_admin_cloud_id or admin_cloud_id
        resolved_domain = email_domain

        try:
            vendors = self.get_connected_vendors()
            vendor_list = vendors if isinstance(vendors, list) else []

            # Collect all identity-provider vendors in priority order
            idp_vendors = []
            for priority in _SOURCE_PRIORITY:
                for v in vendor_list:
                    p = (v.get("providerName") or "").upper().replace(" ", "_")
                    if p == priority and v.get("id") and v.get("domainName"):
                        idp_vendors.append(v)

            if email_domain:
                # IMPORTANT: existingAdminCloudId is NOT based on email domain.
                # It is the M365 tenant that users were IMPORTED FROM in CloudFuze DB.
                # In this org, all users (including @cloudfuze.com) are stored under
                # the primary M365 tenant regardless of their email domain.
                # Strategy: use the first IDP vendor found (highest priority in list).
                # This matches confirmed working terminal test:
                #   chaitanya.malle@cloudfuze.com → existingAdminCloudId=69b28f4d4907036fee79b701
                #   (filefuze.co M365 tenant — the primary import source)
                if idp_vendors:
                    primary_idp = idp_vendors[0]
                    resolved_existing_admin_cloud_id = primary_idp["id"]
                    if not resolved_domain:
                        resolved_domain = primary_idp.get("domainName", "")
                    logger.info(
                        "run_onboard | using primary IDP=%s | existingAdminCloudId=%s | email_domain=%s",
                        primary_idp.get("providerName"), resolved_existing_admin_cloud_id, email_domain,
                    )
                else:
                    logger.warning(
                        "run_onboard | no IDP found | keeping existingAdminCloudId=%s",
                        resolved_existing_admin_cloud_id,
                    )
            else:
                # No domain in email — try to find IDP by passed existing_admin_cloud_id, else use first
                matched = None
                if existing_admin_cloud_id:
                    matched = next((v for v in vendor_list if v.get("id") == existing_admin_cloud_id), None)
                if not matched and idp_vendors:
                    matched = idp_vendors[0]
                if matched:
                    resolved_existing_admin_cloud_id = matched["id"]
                    resolved_domain = matched.get("domainName", "")
                    logger.info(
                        "run_onboard | no domain in email | vendor=%s domain=%s existingAdminCloudId=%s",
                        matched.get("providerName"), resolved_domain, resolved_existing_admin_cloud_id,
                    )

        except Exception as exc:
            logger.warning("run_onboard | vendor list fetch failed: %s", exc)

        # Build full email — must exactly match SaaSUser.emailId in DB
        if "@" in email:
            full_email = email
        elif resolved_domain:
            full_email = f"{username}@{resolved_domain}"
        else:
            full_email = username
            logger.warning("run_onboard | could not resolve domain — full_email=%s", full_email)

        body = [{
            "email": username,
            "displayName": full_email,
            "name": None,
            "firstName": None,
            "lastName": None,
            "passWord": None,
            "changePasswordAtNextLogin": True,
            "alternateEmail": None,
            "vendor": vendor,
            "role": "OTHER",
            "subscriptionsCount": 0,
            "subIds": [],
            "adminMemberId": admin_member_id,
            "adminCloudId": admin_cloud_id,
            "existingUser": True,
            "existingAdminCloudId": resolved_existing_admin_cloud_id,
            "existingMemberId": full_email,
            "deleted": False,
            "saaSApplicationRoles": [],
        }]
        logger.info(
            "workflow | action=run_onboard | email=%s | full_email=%s | vendor=%s | "
            "adminMemberId=%s | existingAdminCloudId=%s",
            username, full_email, vendor, admin_member_id, resolved_existing_admin_cloud_id,
        )
        return self._request("POST", "/api/user/onBoard/users/runFlow", json_body=body)

    # ── Offboard ───────────────────────────────────────────────────────────

    def run_offboard_workflow(self, admin_cloud_id, email, vendor, admin_member_id, perm_delete=False):
        """POST /api/user/offBoard/runFlow
        OFFBOARD: Java getSaaSVendorById(adminMemberId) → findById → needs MongoDB _id (adminCloudId)
        """
        body = {
            "adminMemberId": admin_cloud_id,  # offboard needs _id not memberId
            "email": email,
            "vendor": vendor,
            "adminCloudId": admin_cloud_id,
        }
        logger.info("workflow | action=run_offboard | email=%s | vendor=%s | permDelete=%s",
                    email, vendor, perm_delete)
        return self._request("POST",
                             f"/api/user/offBoard/runFlow?permDelete={str(perm_delete).lower()}",
                             json_body=body)

    def create_offboard_workflow(self, workflow_name, apps, users):
        body = {"workflowName": workflow_name, "apps": apps, "users": users}
        logger.info("workflow | type=offboard | users=%s | apps=%s", users, apps)
        return self._request("POST", "/api/workflow/create/offboardworkflow", json_body=body)

    # ── Other workflows ────────────────────────────────────────────────────

    def run_workflow(self, workflow_id):
        return self._request("POST", f"/api/workflow/run/{workflow_id}")

    def create_conditional_workflow(self, workflow_name, vendor, condition):
        body = {"workflowName": workflow_name, "vendor": vendor, "condition": condition}
        return self._request("POST", "/api/workflow/create/conditionalWorkFlows", json_body=body)

    def list_workflows(self):
        workflows = self._request("GET", "/api/workflow/get/workflows")
        try:
            onboard_workflows = self._request("GET", "/api/workflow/onboard")
        except CloudFuzeAPIError:
            onboard_workflows = []
        if isinstance(workflows, dict):
            workflows["onBoardWorkFlowList"] = onboard_workflows
        return workflows

    def get_workflow_details(self, workflow_id):
        return self._request("GET", f"/api/workflow/get/workflowsdetails/{workflow_id}")

    def get_onboard_users(self, workflow_on_board_details_id):
        return self._request("GET", f"/api/workflow/get/onboarddetails/{workflow_on_board_details_id}")

    def get_offboard_details_by_workflow(self, workflow_id):
        return self._request("GET", f"/api/workflow/get/offboarddetails/{workflow_id}")

    def get_single_offboard_detail(self, workflow_id):
        return self._request("GET", "/api/workflow/offboarddetails", params={"workflowId": workflow_id})

    def get_offboard_apps(self, workflow_offboard_id):
        return self._request("GET", f"/api/workflow/offBoardApps/{workflow_offboard_id}")

    def approve_offboard_workflow(self, workflow_id, approve_status):
        params = {"workflowId": workflow_id, "approveStatus": approve_status}
        logger.info("workflow | type=offboard_approve | workflowId=%s | status=%s", workflow_id, approve_status)
        return self._request("PUT", "/api/workflow/offboarddetails/update", params=params)

    def delete_workflow(self, workflow_id, is_offboard=False):
        """DELETE /api/workflow/delete/{workFlowId}?isOffboardingWorkflow=true/false"""
        logger.info("workflow | type=delete | workflowId=%s | isOffboard=%s", workflow_id, is_offboard)
        return self._request(
            "DELETE",
            f"/api/workflow/delete/{workflow_id}",
            params={"isOffboardingWorkflow": str(is_offboard).lower()},
        )


api_client = CloudFuzeAPIClient()
