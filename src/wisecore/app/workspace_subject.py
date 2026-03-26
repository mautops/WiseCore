# -*- coding: utf-8 -*-
"""Sanitize stable auth ``sub`` (or equivalent) for workspace path segments."""

from __future__ import annotations

import re

_INVALID_SEGMENT = re.compile(r"[\x00-\x1f/\\\\]")


def sanitize_workspace_owner_segment(raw: str) -> str:
    """Return a safe single path segment for ``workspaces/<segment>/``.

    Raises:
        ValueError: When *raw* is empty or contains unsafe characters.
    """
    s = (raw or "").strip()
    if not s or ".." in s:
        raise ValueError("invalid workspace owner segment")
    if _INVALID_SEGMENT.search(s):
        raise ValueError("invalid workspace owner segment")
    if len(s) > 220:
        s = s[:220]
    return s
