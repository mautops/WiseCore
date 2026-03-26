# -*- coding: utf-8 -*-
"""Filesystem utilities for secure file operations."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Union

logger = logging.getLogger(__name__)


def chmod_best_effort(path: Union[Path, str], mode: int) -> None:
    """Change file permissions, ignoring errors.

    Some systems/filesystems may not support chmod semantics.
    """
    try:
        os.chmod(path, mode)
    except OSError as e:
        logger.debug("chmod failed for %s: %s", path, e)


def prepare_secret_parent(path: Union[Path, str]) -> None:
    """Ensure parent directory exists with secure permissions.

    Creates parent directories if needed and sets them to 0o700.
    """
    p = Path(path)
    if not p.parent.exists():
        p.parent.mkdir(parents=True, exist_ok=True)
    chmod_best_effort(p.parent, 0o700)


def safe_write_json(
    path: Path,
    data: dict,
    *,
    mode: int = 0o600,
    ensure_parent: bool = True,
) -> None:
    """Write JSON to file atomically with secure permissions.

    Args:
        path: Target file path
        data: Dictionary to write as JSON
        mode: File permissions (default 0o600)
        ensure_parent: Create parent directories if needed
    """
    import json
    import tempfile

    if ensure_parent:
        prepare_secret_parent(path)

    # Write to temp file first, then rename for atomicity
    fd, tmp_path = tempfile.mkstemp(
        dir=path.parent,
        prefix=path.name + ".",
        suffix=".tmp",
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, path)
        chmod_best_effort(path, mode)
    except Exception:
        # Clean up temp file on failure
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise
