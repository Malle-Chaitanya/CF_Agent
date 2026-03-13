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
                             existing_admin_cloud_id="", display_name=""):
        """POST /api/user/onBoard/users/runFlow — execute onboard for a user.

        No GET to /api/vendor/list. Java fetches domain from storedVendor itself.
        - email: username only (Java appends @domain from storedVendor.domainName)
        - displayName: full email as stored in SaaSUser.emailId (for findUserByAdminCloudIdAndEmailId)
        - existingAdminCloudId: SOURCE vendor adminCloudId (from create_onboard_workflow response)
        """
        username = email.split("@")[0]
        body = [{
            "email": username,
            "displayName": display_name or email,
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
            "existingAdminCloudId": existing_admin_cloud_id or admin_cloud_id,
            "existingMemberId": display_name or email,
            "deleted": False,
            "saaSApplicationRoles": [],
        }]
        logger.info(
            "workflow | action=run_onboard | email=%s | displayName=%s | vendor=%s | "
            "adminMemberId=%s | existingAdminCloudId=%s",
            username, display_name or email, vendor, admin_member_id,
            existing_admin_cloud_id or admin_cloud_id,
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
