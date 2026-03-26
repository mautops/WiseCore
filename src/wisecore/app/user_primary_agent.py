# -*- coding: utf-8 -*-
"""Map stable auth subject to primary agent; provision on first API use.

``owner_subject`` keys the map and workspace path; with next-console upstream
JWT, ``request.state.wisecore_subject`` is the mailbox local-part (JWT ``sub``),
not the IdP numeric/database user id.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path

from starlette.middleware.base import (
    BaseHTTPMiddleware,
    RequestResponseEndpoint,
)
from starlette.requests import Request
from starlette.responses import Response

try:
    import fcntl
except ImportError:
    fcntl = None  # type: ignore[misc, assignment]

from ..constant import SECRET_DIR
from .workspace_subject import sanitize_workspace_owner_segment

logger = logging.getLogger(__name__)

_PRIMARY_AGENT_MAP = SECRET_DIR / "user_primary_agent_map.json"


def user_agent_binding_enabled() -> bool:
    """When false, skip auto-binding (env ``USER_AGENT_BINDING``)."""
    v = os.environ.get("USER_AGENT_BINDING", "0").strip().lower()
    return v not in ("0", "false", "no", "off")


def _prepare_map_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(path.parent, 0o700)
    except OSError:
        pass


def _chmod_map(path: Path) -> None:
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


def get_or_create_primary_agent_id(owner_subject: str) -> str:
    """Return primary agent id; create agent and persist map if missing."""
    sanitize_workspace_owner_segment(owner_subject)
    _prepare_map_parent(_PRIMARY_AGENT_MAP)
    if not _PRIMARY_AGENT_MAP.exists():
        _PRIMARY_AGENT_MAP.write_text("{}", encoding="utf-8")
        _chmod_map(_PRIMARY_AGENT_MAP)

    with open(_PRIMARY_AGENT_MAP, "r+", encoding="utf-8") as f:
        if fcntl is not None:
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        try:
            raw = f.read()
            data: dict[str, str] = json.loads(raw) if raw.strip() else {}
            existing = data.get(owner_subject)
            if existing:
                return str(existing)

            from ..config.utils import load_config
            from .routers.agents import provision_new_agent

            lang = load_config().agents.language or "en"
            ref = provision_new_agent(
                name="Primary",
                description="",
                workspace_dir=None,
                language=lang,
                owner_segment=owner_subject,
            )
            data[owner_subject] = ref.id
            f.seek(0)
            f.truncate()
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
            _chmod_map(_PRIMARY_AGENT_MAP)
            logger.info(
                "Provisioned primary agent %s for subject key %s",
                ref.id,
                owner_subject,
            )
            return ref.id
        finally:
            if fcntl is not None:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)


def _should_skip_path(path: str) -> bool:
    """Lightweight routes: no primary-agent binding."""
    return path == "/api/version"


class UserPrimaryAgentMiddleware(BaseHTTPMiddleware):
    """Set ``request.state.agent_id`` from subject -> primary agent map."""

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)
        if not request.url.path.startswith("/api/"):
            return await call_next(request)
        if not user_agent_binding_enabled():
            return await call_next(request)
        if _should_skip_path(request.url.path):
            return await call_next(request)
        if request.headers.get("X-Agent-Id", "").strip():
            return await call_next(request)

        subject = getattr(request.state, "wisecore_subject", None)
        if not subject:
            return await call_next(request)

        try:
            agent_id = await asyncio.to_thread(
                get_or_create_primary_agent_id,
                subject,
            )
        except ValueError as e:
            logger.warning("Primary agent binding skipped: %s", e)
            return await call_next(request)
        except Exception:
            logger.exception("Primary agent binding failed")
            return await call_next(request)

        request.state.agent_id = agent_id
        from .agent_context import set_current_agent_id

        set_current_agent_id(agent_id)
        return await call_next(request)
