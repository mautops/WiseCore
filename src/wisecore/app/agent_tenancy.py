# -*- coding: utf-8 -*-
"""Scope agent APIs to workspaces/<wisecore_subject>/ when user binding is on."""

from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException, Request

from ..config.utils import load_config
from ..constant import WORKING_DIR
from .user_primary_agent import user_agent_binding_enabled


def workspace_dir_owned_by_subject(workspace_dir: str, subject: str) -> bool:
    """True if workspace_dir resolves under WORKING_DIR/workspaces/subject/."""
    try:
        base = (WORKING_DIR / "workspaces" / subject).resolve()
        ws = Path(workspace_dir).expanduser().resolve()
    except OSError:
        return False
    if ws == base:
        return True
    try:
        ws.relative_to(base)
        return True
    except ValueError:
        return False


def ensure_agent_allowed_for_request(request: Request, agent_id: str) -> None:
    """403 if forbidden tenant access; 404 if agent id missing from config."""
    if not user_agent_binding_enabled():
        return
    raw = getattr(request.state, "wisecore_subject", None)
    if not raw or not isinstance(raw, str) or not raw.strip():
        return
    subject = raw.strip()
    config = load_config()
    ref = config.agents.profiles.get(agent_id)
    if ref is None:
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{agent_id}' not found",
        )
    if workspace_dir_owned_by_subject(ref.workspace_dir, subject):
        return
    raise HTTPException(
        status_code=403,
        detail="Agent not accessible for this user",
    )


def list_profile_ids_for_subject(subject: str) -> set[str]:
    """Agent ids whose workspace lives under this subject's tree."""
    config = load_config()
    out: set[str] = set()
    for aid, ref in config.agents.profiles.items():
        if workspace_dir_owned_by_subject(ref.workspace_dir, subject):
            out.add(aid)
    return out
