"""CloudFuze User Management Agent — powered by OpenAI function calling.

Responsibilities:
  1. Load the system prompt and tool definitions.
  2. Maintain conversational context via Redis-backed memory.
  3. Parse admin prompts, invoke the right tool, and return friendly answers.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from openai import OpenAI

from config import settings
from schemas.tool_schema import TOOL_DEFINITIONS
from tools import TOOL_HANDLERS
from memory.redis_memory import store_message, get_history

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "system_prompt.txt"


def _load_system_prompt() -> str:
    try:
        return _SYSTEM_PROMPT_PATH.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        logger.warning("System prompt file not found at %s — using fallback.", _SYSTEM_PROMPT_PATH)
        return "You are a helpful SaaS user management assistant."


class UserManagementAgent:
    """Stateless-per-request agent. Conversation state lives in Redis."""

    def __init__(self) -> None:
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_MODEL
        self.system_prompt = _load_system_prompt()
        self.tools = TOOL_DEFINITIONS

    def _build_messages(self, session_id: str, user_prompt: str) -> list[dict[str, str]]:
        """Assemble the message list: system + history + current user turn."""
        messages: list[dict[str, str]] = [{"role": "system", "content": self.system_prompt}]
        history = get_history(session_id)
        messages.extend(history)
        messages.append({"role": "user", "content": user_prompt})
        return messages

    def _execute_tool(self, name: str, arguments: dict[str, Any]) -> str:
        """Dispatch to the matching tool handler."""
        handler = TOOL_HANDLERS.get(name)
        if handler is None:
            return json.dumps({"error": f"Unknown tool: {name}"})

        logger.info("Executing tool=%s args=%s", name, arguments)

        if settings.DEBUG:
            print(f"\n[DEBUG] Selected tool : {name}")
            print(f"[DEBUG] Parameters    : {json.dumps(arguments, indent=2)}")

        return handler(arguments)

    def run(self, session_id: str, user_prompt: str) -> str:
        """Process a single user prompt end-to-end and return the agent's answer."""
        store_message(session_id, "user", user_prompt)
        messages = self._build_messages(session_id, user_prompt)

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=self.tools,
                tool_choice="auto",
            )
        except Exception as exc:
            logger.exception("OpenAI API call failed")
            return f"Sorry, I couldn't process your request. Error: {exc}"

        assistant_message = response.choices[0].message

        # Iterative tool-calling loop (handles chained / parallel tool calls)
        max_iterations = 10
        iteration = 0
        while assistant_message.tool_calls and iteration < max_iterations:
            iteration += 1
            messages.append(assistant_message.model_dump())

            for tool_call in assistant_message.tool_calls:
                fn_name = tool_call.function.name
                try:
                    fn_args = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    fn_args = {}

                tool_result = self._execute_tool(fn_name, fn_args)

                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": tool_result,
                    }
                )

            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    tools=self.tools,
                    tool_choice="auto",
                )
            except Exception as exc:
                logger.exception("OpenAI API call failed during tool loop")
                return f"Sorry, I couldn't process your request. Error: {exc}"

            assistant_message = response.choices[0].message

        answer = assistant_message.content or "I completed the action but have nothing to report."
        store_message(session_id, "assistant", answer)
        return answer
