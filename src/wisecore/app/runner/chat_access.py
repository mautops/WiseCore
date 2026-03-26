# -*- coding: utf-8 -*-
"""Chat visibility tied to ``request.state.user`` (access token)."""

from __future__ import annotations

from typing import Iterable, Optional

from fastapi import HTTPException, Request

from ..auth import _workflow_segment_from_claim_value
from .models import ChatSpec


def token_user_id(request: Request) -> Optional[str]:
    """Return tenant user id if authenticated, else *None* (e.g. local CLI).

    Keycloak access token claims map to ``request.state.user``
    (e.g. ``preferred_username`` or email local-part),
    stored as ``ChatSpec.user_id``.
    """
    raw = getattr(request.state, "user", None)
    if raw is None:
        return None
    s = str(raw).strip()
    return s or None


def chat_row_visible_to_aliases(
    stored_user_id: str,
    aliases: Iterable[str],
) -> bool:
    """True if persisted ``user_id`` matches any JWT alias.

    Aliases may be local-part, email, uid, etc.
    """
    for raw in aliases:
        a = str(raw).strip()
        if not a:
            continue
        if stored_user_id == a:
            return True
        if chat_stored_user_id_matches(stored_user_id, a):
            return True
    return False


def request_chat_visibility_aliases(request: Request) -> list[str]:
    """Aliases from upstream JWT for next-console.

    Includes mailbox local-part, email, and Better Auth id when present.
    """
    raw = getattr(request.state, "wisecore_chat_aliases", None)
    if isinstance(raw, list) and raw:
        out: list[str] = []
        for x in raw:
            s = str(x).strip()
            if s and s not in out:
                out.append(s)
        return out
    tu = token_user_id(request)
    return [tu] if tu else []


def chat_stored_user_id_matches(
    stored_user_id: str, token_user_id: str
) -> bool:
    """True if persisted ``ChatSpec.user_id`` is visible to the JWT user.

    Next-console historically stored full email as ``user_id`` while the token
    user is the mailbox local-part; normalize so list/get still match.
    """
    if stored_user_id == token_user_id:
        return True
    seg = _workflow_segment_from_claim_value(stored_user_id)
    return bool(seg and seg == token_user_id)


def ensure_chat_visible(
    spec: Optional[ChatSpec], request: Request
) -> ChatSpec:
    """404 if missing or not visible to the current token user."""
    if not spec:
        raise HTTPException(status_code=404, detail="Chat not found")
    aliases = request_chat_visibility_aliases(request)
    if aliases and not chat_row_visible_to_aliases(spec.user_id, aliases):
        raise HTTPException(status_code=404, detail="Chat not found")
    return spec
