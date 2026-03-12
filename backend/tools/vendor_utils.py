"""Shared vendor normalization — single source of truth for all tools."""

from __future__ import annotations

from typing import Any

_VENDOR_MAP: dict[str, str] = {
    "google workspace": "GOOGLE_WORKSPACE",
    "google": "GOOGLE_WORKSPACE",
    "gwsuite": "GOOGLE_WORKSPACE",
    "g suite": "GOOGLE_WORKSPACE",
    "gsuite": "GOOGLE_WORKSPACE",
    "slack": "SLACK",
    "github": "GITHUB",
    "zoom": "ZOOM",
    "microsoft 365": "MICROSOFT_365",
    "microsoft365": "MICROSOFT_365",
    "m365": "MICROSOFT_365",
    "office 365": "MICROSOFT_365",
    "office365": "MICROSOFT_365",
    "dropbox": "DROPBOX",
    "salesforce": "SALESFORCE",
    "servicenow": "SERVICENOW",
    "jira": "JIRA",
    "confluence": "CONFLUENCE",
    "okta": "OKTA",
    "box": "BOX",
    "hubspot": "HUBSPOT",
    "zendesk": "ZENDESK",
    "asana": "ASANA",
    "notion": "NOTION",
    "articulate 360": "ARTICULATE_360",
    "articulate360": "ARTICULATE_360",
    "articulate": "ARTICULATE_360",
    "figma": "FIGMA",
}


def normalize_vendor(raw: str) -> str:
    """Coerce any vendor string to canonical uppercase enum value."""
    key = raw.strip().lower()
    return _VENDOR_MAP.get(key, raw.strip().upper().replace(" ", "_"))


def normalize_applications(raw: Any) -> list[dict[str, str]] | None:
    """Coerce GPT output into [{vendor: ...}] list. Returns None if invalid."""
    if isinstance(raw, str):
        raw = [raw]
    if isinstance(raw, dict):
        raw = [raw]
    if not isinstance(raw, list) or len(raw) == 0:
        return None
    result = []
    for item in raw:
        if isinstance(item, str):
            result.append({"vendor": normalize_vendor(item)})
        elif isinstance(item, dict) and "vendor" in item:
            result.append({"vendor": normalize_vendor(str(item["vendor"]))})
        else:
            return None
    return result


def normalize_users(raw: Any) -> list[dict[str, str]] | None:
    """Coerce GPT output into [{email: ...}] list. Returns None if invalid."""
    if isinstance(raw, str):
        raw = [raw]
    if isinstance(raw, dict):
        raw = [raw]
    if not isinstance(raw, list) or len(raw) == 0:
        return None
    result = []
    for item in raw:
        if isinstance(item, str):
            result.append({"email": item})
        elif isinstance(item, dict) and "email" in item:
            entry: dict[str, str] = {"email": str(item["email"])}
            if item.get("name"):
                entry["name"] = str(item["name"])
            result.append(entry)
        else:
            return None
    return result
