"""OpenAI function-calling tool definitions for the CloudFuze Workflow agent.

Each entry follows the OpenAI *tools* format so it can be passed directly to
the chat completions API.
"""

from __future__ import annotations

TOOL_DEFINITIONS: list[dict] = [
    # ------------------------------------------------------------------
    # Connected vendors (prerequisite for onboard)
    # ------------------------------------------------------------------
    {
        "type": "function",
        "function": {
            "name": "get_connected_vendors",
            "description": (
                "List all SaaS applications connected to this CloudFuze account. "
                "Returns adminCloudId, providerName, adminEmail, domainName for each. "
                "Call this before create_onboard_workflow to resolve a vendor name to its connected account, "
                "or when the admin asks what apps are connected."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    # ------------------------------------------------------------------
    # Workflow creation
    # ------------------------------------------------------------------
    {
        "type": "function",
        "function": {
            "name": "create_onboard_workflow",
            "description": (
                "Create an onboarding workflow to provision one or more users into a connected SaaS application. "
                "Use when the admin wants to onboard or add someone (e.g. to Articulate 360, Slack, Google Workspace). "
                "Requires the app to be connected in CloudFuze — call get_connected_vendors first to confirm, "
                "or pass the connected_vendors result from a previous get_connected_vendors call."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "vendor_name": {
                        "type": "string",
                        "description": "Vendor/app name, e.g. ARTICULATE_360, SLACK, GOOGLE_WORKSPACE.",
                    },
                    "workflow_name": {
                        "type": "string",
                        "description": "Descriptive name for this workflow (optional).",
                    },
                    "users": {
                        "type": "array",
                        "description": "List of users to onboard.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "email": {"type": "string"},
                                "name": {"type": "string"},
                            },
                            "required": ["email"],
                        },
                    },
                    "connected_vendors": {
                        "type": "array",
                        "description": "Optional. Result from get_connected_vendors to avoid a second API call.",
                        "items": {"type": "object"},
                    },
                },
                "required": ["vendor_name", "users"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_offboard_workflow",
            "description": (
                "Create an offboarding workflow to deprovision one or more users from one or more SaaS applications. "
                "Use when the admin wants to remove, offboard, or deprovision someone. "
                "Note: offboard workflows require approval before execution — use approve_offboard_workflow after creation."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "workflow_name": {
                        "type": "string",
                        "description": "Descriptive name for this workflow, e.g. 'Offboard John from Slack'.",
                    },
                    "apps": {
                        "type": "array",
                        "description": "List of SaaS applications to offboard the user(s) from.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "vendor": {
                                    "type": "string",
                                    "description": "Vendor name, e.g. SLACK, GOOGLE_WORKSPACE, GITHUB.",
                                }
                            },
                            "required": ["vendor"],
                        },
                    },
                    "users": {
                        "type": "array",
                        "description": "List of users to offboard.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "email": {
                                    "type": "string",
                                    "description": "User's email address.",
                                }
                            },
                            "required": ["email"],
                        },
                    },
                },
                "required": ["workflow_name", "apps", "users"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_conditional_workflow",
            "description": (
                "Create a conditional automation workflow that triggers on a rule-based condition, "
                "such as disabling inactive users, auto-provisioning new hires, or suspending accounts. "
                "Use for scheduled or event-driven automations."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "workflow_name": {
                        "type": "string",
                        "description": "Descriptive name for this workflow.",
                    },
                    "vendor": {
                        "type": "string",
                        "description": "Target SaaS vendor, e.g. SLACK, GOOGLE_WORKSPACE.",
                    },
                    "condition": {
                        "type": "string",
                        "description": "The condition that triggers this workflow, e.g. 'inactive_users', 'new_hire'.",
                    },
                },
                "required": ["workflow_name", "vendor", "condition"],
            },
        },
    },
    # ------------------------------------------------------------------
    # User pre-registration (required before runFlow)
    # ------------------------------------------------------------------
    {
        "type": "function",
        "function": {
            "name": "pre_register_user",
            "description": (
                "Pre-register a user in CloudFuze's database before running an onboard workflow. "
                "The Java backend requires users to exist with created=true before runFlow can provision them. "
                "Call this AFTER create_onboard_workflow and BEFORE run_workflow. "
                "Requires email, vendor, and admin_member_id (SaaSVendor.memberId UUID from get_connected_vendors). "
                "run_workflow will auto-call this if you skip it, but calling explicitly gives better error reporting."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "email": {
                        "type": "string",
                        "description": "Full email of the user to pre-register (e.g. user@company.com).",
                    },
                    "vendor": {
                        "type": "string",
                        "description": "SaaS provider name (e.g. ARTICULATE_360, SLACK).",
                    },
                    "admin_member_id": {
                        "type": "string",
                        "description": "SaaSVendor.memberId UUID from get_connected_vendors or create_onboard_workflow response.",
                    },
                    "first_name": {
                        "type": "string",
                        "description": "User's first name (optional, defaults to username part of email).",
                    },
                    "last_name": {
                        "type": "string",
                        "description": "User's last name (optional, defaults to username part of email).",
                    },
                },
                "required": ["email", "vendor", "admin_member_id"],
            },
        },
    },
    # ------------------------------------------------------------------
    # Workflow execution
    # ------------------------------------------------------------------
    {
        "type": "function",
        "function": {
            "name": "run_workflow",
            "description": (
                "Execute an onboarding or offboarding workflow for a user. "
                "Use when the admin says 'run', 'execute', 'start', 'trigger', or 'yes' (after you offered to run). "
                "When the user says 'yes' or 'run it' in the same conversation right after you created an onboard workflow, use the email, vendor, admin_cloud_id, and admin_member_id from that create_onboard_workflow tool result in this conversation — do NOT call list_workflows (that would use a different workflow and wrong user). "
                "Otherwise you need: email, vendor, admin_cloud_id, admin_member_id (from get_connected_vendors or create_onboard_workflow response). "
                "For offboard use workflow_type='offboard'. For offboard permanent deletion pass perm_delete=true."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "workflow_type": {
                        "type": "string",
                        "enum": ["onboard", "offboard"],
                        "description": "Type of workflow to run. Default is 'onboard'.",
                    },
                    "email": {
                        "type": "string",
                        "description": "FULL email with domain (e.g. chaitanya.malle@cloudfuze.com). NEVER just a username — the domain is required to match the correct identity provider and look up the user in the DB.",
                    },
                    "vendor": {
                        "type": "string",
                        "description": "SaaS provider name (e.g. ARTICULATE_360, SLACK, GOOGLE_WORKSPACE).",
                    },
                    "admin_cloud_id": {
                        "type": "string",
                        "description": "adminCloudId from the connected vendor (get_connected_vendors response).",
                    },
                    "admin_member_id": {
                        "type": "string",
                        "description": "SaaSVendor.memberId from get_connected_vendors or create_onboard_workflow response (NOT adminCloudId — the backend looks up by memberId).",
                    },
                    "perm_delete": {
                        "type": "boolean",
                        "description": "Offboard only: permanently delete the user. Default false.",
                    },
                    "existing_admin_cloud_id": {
                        "type": "string",
                        "description": "The adminCloudId of the source vendor where the user currently exists in CloudFuze (e.g. Microsoft 365 adminCloudId). Comes from create_onboard_workflow response field 'existing_admin_cloud_id'. Used as existingAdminCloudId in the runFlow body so Java can find the user.",
                    },
                },
                "required": ["email", "vendor", "admin_cloud_id", "admin_member_id"],
            },
        },
    },
    # ------------------------------------------------------------------
    # Workflow inspection
    # ------------------------------------------------------------------
    {
        "type": "function",
        "function": {
            "name": "list_workflows",
            "description": (
                "List all workflows created by the authenticated admin. "
                "Use when the admin asks to see their workflows, show all workflows, or view existing automations."
            ),
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
            "name": "get_workflow_details",
            "description": (
                "Fetch full details for a specific workflow by its ID. "
                "Use when the admin asks about a specific workflow by ID."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "workflow_id": {
                        "type": "string",
                        "description": "The unique ID of the workflow to inspect.",
                    }
                },
                "required": ["workflow_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_onboard_users",
            "description": (
                "Retrieve the users associated with a specific onboard workflow detail record. "
                "Use when the admin wants to see who was onboarded under a specific onboard details ID."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "workflow_on_board_details_id": {
                        "type": "string",
                        "description": "The onboard workflow details record ID.",
                    }
                },
                "required": ["workflow_on_board_details_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_offboard_details",
            "description": (
                "Fetch offboard workflow details for a specific workflow by ID. "
                "Use when the admin wants to check the status of an offboard request, "
                "see who is being offboarded, or review what apps are being revoked. "
                "Requires a workflow_id — call list_workflows first if the admin doesn't know the ID."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "workflow_id": {
                        "type": "string",
                        "description": "The ID of the offboard workflow to retrieve details for.",
                    }
                },
                "required": ["workflow_id"],
            },
        },
    },
    # ------------------------------------------------------------------
    # Workflow actions
    # ------------------------------------------------------------------
    {
        "type": "function",
        "function": {
            "name": "approve_offboard_workflow",
            "description": (
                "Approve or reject a pending offboard workflow. "
                "Offboard workflows do not execute until approved — this is the gate. "
                "Use when the admin says 'approve', 'reject', or 'deny' for an offboard workflow."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "workflow_id": {
                        "type": "string",
                        "description": "The ID of the offboard workflow to approve or reject.",
                    },
                    "approve_status": {
                        "type": "string",
                        "enum": ["APPROVED", "REJECTED"],
                        "description": "APPROVED to allow execution, REJECTED to cancel it.",
                    },
                },
                "required": ["workflow_id", "approve_status"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_workflow",
            "description": (
                "Permanently delete a workflow by its ID. "
                "Use when the admin wants to remove or delete a workflow. "
                "Pass is_offboard=true when deleting an offboard workflow so Java deletes from the correct collection."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "workflow_id": {
                        "type": "string",
                        "description": "The ID of the workflow to delete.",
                    },
                    "is_offboard": {
                        "type": "boolean",
                        "description": (
                            "Set to true when deleting an offboard workflow (OffBoardWorkFlow collection). "
                            "Default false for onboard workflows."
                        ),
                        "default": False,
                    },
                },
                "required": ["workflow_id"],
            },
        },
    },
]
