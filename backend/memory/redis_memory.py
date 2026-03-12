"""Conversation memory backed by Redis.

Falls back to an in-memory dict when Redis is unavailable so the agent
still works during local development without a Redis server.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from config import settings

logger = logging.getLogger(__name__)

_redis_client: Any | None = None
_fallback_store: dict[str, list[dict[str, str]]] = {}

MAX_HISTORY_LENGTH = 50


def _get_redis():
    """Lazy-initialise the Redis connection."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    try:
        import redis as redis_lib

        _redis_client = redis_lib.Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=3,
        )
        _redis_client.ping()
        logger.info("Connected to Redis at %s", settings.REDIS_URL)
        return _redis_client
    except Exception as exc:
        logger.warning("Redis unavailable (%s) — using in-memory fallback.", exc)
        _redis_client = None
        return None


def _key(session_id: str) -> str:
    return f"cloudfuze:chat:{session_id}"


def store_message(session_id: str, role: str, content: str) -> None:
    """Append a message to the session history."""
    entry = json.dumps({"role": role, "content": content})
    client = _get_redis()

    if client is not None:
        try:
            client.rpush(_key(session_id), entry)
            client.ltrim(_key(session_id), -MAX_HISTORY_LENGTH, -1)
            return
        except Exception as exc:
            logger.warning("Redis write failed: %s", exc)

    history = _fallback_store.setdefault(session_id, [])
    history.append({"role": role, "content": content})
    if len(history) > MAX_HISTORY_LENGTH:
        _fallback_store[session_id] = history[-MAX_HISTORY_LENGTH:]


def get_history(session_id: str) -> list[dict[str, str]]:
    """Retrieve the full conversation history for a session."""
    client = _get_redis()

    if client is not None:
        try:
            raw_items = client.lrange(_key(session_id), 0, -1)
            return [json.loads(item) for item in raw_items]
        except Exception as exc:
            logger.warning("Redis read failed: %s", exc)

    return list(_fallback_store.get(session_id, []))


def clear_history(session_id: str) -> None:
    """Delete conversation history for a session."""
    client = _get_redis()

    if client is not None:
        try:
            client.delete(_key(session_id))
        except Exception as exc:
            logger.warning("Redis delete failed: %s", exc)

    _fallback_store.pop(session_id, None)
