# -*- coding: utf-8 -*-
"""Chat visibility tied to ``request.state.user`` (access token)."""

from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, Request

from .models import ChatSpec


def token_user_id(request: Request) -> Optional[str]:
    """Return API user id if authenticated, else *None* (e.g. local CLI)."""
    raw = getattr(request.state, "user", None)
    if raw is None:
        return None
    s = str(raw).strip()
    return s or None


def ensure_chat_visible(
    spec: Optional[ChatSpec], request: Request
) -> ChatSpec:
    """404 if missing or not visible to the current token user."""
    if not spec:
        raise HTTPException(status_code=404, detail="Chat not found")
    tu = token_user_id(request)
    if tu is not None and spec.user_id != tu:
        raise HTTPException(status_code=404, detail="Chat not found")
    return spec
