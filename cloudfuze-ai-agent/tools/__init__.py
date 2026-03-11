"""Tool registry — maps function names to callable handlers."""

from tools.create_user import handle_create_user
from tools.delete_user import handle_delete_user
from tools.get_users import handle_get_users
from tools.count_users import handle_count_users
from tools.reset_password import handle_reset_password
from tools.get_user_apps import handle_get_user_apps

TOOL_HANDLERS: dict[str, callable] = {
    "create_user": handle_create_user,
    "delete_user": handle_delete_user,
    "get_users": handle_get_users,
    "count_users": handle_count_users,
    "reset_password": handle_reset_password,
    "get_user_apps": handle_get_user_apps,
}
