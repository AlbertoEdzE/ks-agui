"""In-memory draft registry with TTL enforcement for scenario_4."""
from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Any

_store: dict[str, dict[str, Any]] = {}
_lock = threading.Lock()


def save(draft: dict[str, Any]) -> None:
    with _lock:
        _store[draft["draft_id"]] = draft


def get(draft_id: str) -> dict[str, Any] | None:
    with _lock:
        return _store.get(draft_id)


def mark_confirmed(draft_id: str) -> None:
    with _lock:
        if draft_id in _store:
            _store[draft_id]["status"] = "Confirmed"


def mark_executed(draft_id: str) -> None:
    with _lock:
        if draft_id in _store:
            _store[draft_id]["status"] = "Executed"


def is_expired(draft_id: str) -> bool:
    with _lock:
        draft = _store.get(draft_id)
        if draft is None:
            return True
        expires_at_str: str = draft["expires_at"]
        expires_at = datetime.fromisoformat(expires_at_str)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        return expires_at < datetime.now(timezone.utc)


def clear() -> None:
    with _lock:
        _store.clear()
