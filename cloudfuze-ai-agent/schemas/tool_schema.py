"""OpenAI function-calling tool definitions for the CloudFuze agent.

Each entry follows the OpenAI *tools* format so it can be passed directly to
the chat completions API.
"""

from __future__ import annotations

TOOL_DEFINITIONS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "create_user",
            "description": (
                "Onboard / create a user in a SaaS application via CloudFuze. "
                "Use when the admin wants to add someone to Slack, Google Workspace, GitHub, Zoom, etc."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "email": {
                        "type": "string",
                        "description": "Email address of the user to onboard.",
                    },
                    "vendor": {
                        "type": "string",
                        "description": "SaaS vendor name, e.g. Slack, GoogleWorkspace, GitHub, Zoom.",
                    },
                    "admin_member_id": {
                        "type": "string",
                        "description": "Admin member ID that owns the SaaS subscription.",
                    },
                    "role": {
                        "type": "string",
                        "description": "Role to assign (default: user).",
                        "default": "user",
                    },
                    "name": {
                        "type": "string",
                        "description": "Display name for the new user.",
                        "default": "",
                    },
                    "password": {
                        "type": "string",
                        "description": "Initial password (optional).",
                        "default": "",
                    },
                },
                "required": ["email", "vendor", "admin_member_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_user",
            "description": (
                "Offboard / remove a user from a SaaS application. "
                "Use when the admin wants to delete or remove someone."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "email": {
                        "type": "string",
                        "description": "Email address of the user to offboard.",
                    },
                    "vendor": {
                        "type": "string",
                        "description": "SaaS vendor name.",
                    },
                    "admin_member_id": {
                        "type": "string",
                        "description": "Admin member ID.",
                    },
                    "perm_delete": {
                        "type": "boolean",
                        "description": "Permanently delete the user (default: false).",
                        "default": False,
                    },
                },
                "required": ["email", "vendor", "admin_member_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_users",
            "description": (
                "List users from a SaaS application. Supports filtering by vendor, "
                "role, and active status with pagination."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "admin_member_id": {
                        "type": "string",
                        "description": "Admin member ID.",
                    },
                    "vendor": {
                        "type": "string",
                        "description": "Filter by SaaS vendor name.",
                        "default": "",
                    },
                    "role": {
                        "type": "string",
                        "description": "Filter by role.",
                        "default": "",
                    },
                    "active_status": {
                        "type": "string",
                        "description": "Filter by active status (active / inactive).",
                        "default": "",
                    },
                    "page": {
                        "type": "integer",
                        "description": "Page number (0-based).",
                        "default": 0,
                    },
                    "size": {
                        "type": "integer",
                        "description": "Page size.",
                        "default": 20,
                    },
                },
                "required": ["admin_member_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "count_users",
            "description": "Return the total number of users managed by CloudFuze.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "reset_password",
            "description": "Reset a user's password in a SaaS application.",
            "parameters": {
                "type": "object",
                "properties": {
                    "email": {
                        "type": "string",
                        "description": "Email address of the user.",
                    },
                    "vendor": {
                        "type": "string",
                        "description": "SaaS vendor name.",
                    },
                    "admin_member_id": {
                        "type": "string",
                        "description": "Admin member ID.",
                    },
                },
                "required": ["email", "vendor", "admin_member_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_apps",
            "description": "List all SaaS applications a specific user belongs to.",
            "parameters": {
                "type": "object",
                "properties": {
                    "email": {
                        "type": "string",
                        "description": "Email address of the user.",
                    },
                },
                "required": ["email"],
            },
        },
    },
]
