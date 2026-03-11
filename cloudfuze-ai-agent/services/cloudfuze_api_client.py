"""HTTP client for the CloudFuze Java backend REST API.

Every public method includes:
  - authentication headers
  - configurable timeout
  - automatic retries with exponential back-off
  - structured error handling
"""

from __future__ import annotations

import logging
from typing import Any

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from config import settings

logger = logging.getLogger(__name__)


class CloudFuzeAPIError(Exception):
    """Raised when the CloudFuze backend returns a non-2xx response."""

    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"CloudFuze API error {status_code}: {detail}")


class CloudFuzeAPIClient:
    """Thin wrapper around the CloudFuze user-management REST API."""

    def __init__(self) -> None:
        self.base_url = settings.CLOUDFUZE_BASE_URL.rstrip("/")
        self.timeout = settings.API_REQUEST_TIMEOUT
        self.session = self._build_session()

    def _build_session(self) -> requests.Session:
        session = requests.Session()
        session.headers.update(
            {
                "Authorization": f"Bearer {settings.CLOUDFUZE_TOKEN}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        )
        retry_strategy = Retry(
            total=settings.API_MAX_RETRIES,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "POST"],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        return session

    def _request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        json_body: dict[str, Any] | None = None,
    ) -> dict[str, Any] | list[Any]:
        url = f"{self.base_url}{path}"
        logger.info("API %s %s params=%s body=%s", method, url, params, json_body)

        try:
            response = self.session.request(
                method,
                url,
                params=params,
                json=json_body,
                timeout=self.timeout,
                headers=self.session.headers,
            )
        except requests.exceptions.ConnectionError as exc:
            logger.error("Connection error: %s", exc)
            raise CloudFuzeAPIError(0, f"Cannot reach CloudFuze backend at {url}") from exc
        except requests.exceptions.Timeout as exc:
            logger.error("Timeout: %s", exc)
            raise CloudFuzeAPIError(0, "Request to CloudFuze backend timed out") from exc
        except requests.exceptions.RequestException as exc:
            logger.error("Request error: %s", exc)
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

    # ------------------------------------------------------------------
    # Public helpers — one per backend endpoint
    # ------------------------------------------------------------------

    def create_user(
        self,
        email: str,
        vendor: str,
        admin_member_id: str,
        role: str = "user",
        name: str = "",
        password: str = "",
    ) -> dict[str, Any] | list[Any]:
        """POST /api/user/onBoard/runFlow"""
        body: dict[str, Any] = {
            "email": email,
            "vendor": vendor,
            "adminMemberId": admin_member_id,
            "role": role,
        }
        if name:
            body["name"] = name
        if password:
            body["password"] = password
        return self._request("POST", "/api/user/onBoard/runFlow", json_body=body)

    def delete_user(
        self,
        email: str,
        vendor: str,
        admin_member_id: str,
        perm_delete: bool = False,
    ) -> dict[str, Any] | list[Any]:
        """POST /api/user/offBoard/runFlow"""
        body = {
            "email": email,
            "vendor": vendor,
            "adminMemberId": admin_member_id,
            "permDelete": perm_delete,
        }
        return self._request("POST", "/api/user/offBoard/runFlow", json_body=body)

    def get_users(
        self,
        admin_member_id: str,
        vendor: str = "",
        role: str = "",
        active_status: str = "",
        page: int = 0,
        size: int = 20,
    ) -> dict[str, Any] | list[Any]:
        """GET /api/user/{adminMemberId}/users"""
        params: dict[str, Any] = {"page": page, "size": size}
        if vendor:
            params["vendor"] = vendor
        if role:
            params["role"] = role
        if active_status:
            params["activeStatus"] = active_status
        return self._request(
            "GET",
            f"/api/user/{admin_member_id}/users",
            params=params,
        )

    def count_users(self) -> dict[str, Any] | list[Any]:
        """GET /api/user/count"""
        return self._request("GET", "/api/user/count")

    def reset_password(
        self,
        email: str,
        vendor: str,
        admin_member_id: str,
    ) -> dict[str, Any] | list[Any]:
        """POST /api/user/offBoard/pwd"""
        body = {
            "email": email,
            "vendor": vendor,
            "adminMemberId": admin_member_id,
        }
        return self._request("POST", "/api/user/offBoard/pwd", json_body=body)

    def get_user_apps(self, email: str) -> dict[str, Any] | list[Any]:
        """GET /api/user/users/apps/{email}"""
        return self._request("GET", f"/api/user/users/apps/{email}")

    def get_app_roles(self, admin_cloud_id: str) -> dict[str, Any] | list[Any]:
        """GET /api/user/apps/roles/{adminCloudId}"""
        return self._request("GET", f"/api/user/apps/roles/{admin_cloud_id}")


api_client = CloudFuzeAPIClient()
