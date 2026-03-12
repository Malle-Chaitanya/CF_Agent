"""Tool registry — maps OpenAI function names to callable handlers."""

from tools.get_connected_vendors import handle_get_connected_vendors
from tools.create_onboard_workflow import handle_create_onboard_workflow
from tools.create_offboard_workflow import handle_create_offboard_workflow
from tools.create_conditional_workflow import handle_create_conditional_workflow
from tools.pre_register_user import handle_pre_register_user
from tools.run_workflow import handle_run_workflow
from tools.list_workflows import handle_list_workflows
from tools.get_workflow_details import handle_get_workflow_details
from tools.get_onboard_users import handle_get_onboard_users
from tools.get_offboard_details import handle_get_offboard_details
from tools.approve_offboard_workflow import handle_approve_offboard_workflow
from tools.delete_workflow import handle_delete_workflow

TOOL_HANDLERS: dict[str, callable] = {
    "get_connected_vendors": handle_get_connected_vendors,
    "create_onboard_workflow": handle_create_onboard_workflow,
    "create_offboard_workflow": handle_create_offboard_workflow,
    "create_conditional_workflow": handle_create_conditional_workflow,
    "pre_register_user": handle_pre_register_user,
    "run_workflow": handle_run_workflow,
    "list_workflows": handle_list_workflows,
    "get_workflow_details": handle_get_workflow_details,
    "get_onboard_users": handle_get_onboard_users,
    "get_offboard_details": handle_get_offboard_details,
    "approve_offboard_workflow": handle_approve_offboard_workflow,
    "delete_workflow": handle_delete_workflow,
}
