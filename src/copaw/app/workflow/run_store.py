# -*- coding: utf-8 -*-
"""Append-only workflow run history: one JSON list file per workflow."""

from __future__ import annotations

import asyncio
import json
import logging
import re
import shutil
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, List

from ...constant import WORKFLOW_RUNS_DIR

logger = logging.getLogger(__name__)

_UNSAFE_FILENAME_RE = re.compile(r'[\\/:*?"<>|]')


def _safe_basename(name: str) -> str:
    return _UNSAFE_FILENAME_RE.sub("--", name)


def runs_file_path(workflow_filename: str) -> Path:
    """Path to the JSON list file for *workflow_filename* (e.g. daily.md)."""
    safe = _safe_basename(workflow_filename)
    return WORKFLOW_RUNS_DIR / f"{safe}.runs.json"


def _load_list(path: Path) -> List[dict[str, Any]]:
    if not path.is_file():
        return []
    try:
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw) if raw.strip() else []
    except (json.JSONDecodeError, OSError) as e:
        logger.warning("Failed to read workflow runs %s: %s", path, e)
        return []
    if not isinstance(data, list):
        return []
    out: List[dict[str, Any]] = []
    for item in data:
        if isinstance(item, dict):
            out.append(item)
    return out


def _save_atomic(path: Path, items: List[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(
        json.dumps(items, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    shutil.move(str(tmp_path), str(path))


def delete_runs_file(workflow_filename: str) -> None:
    """Remove run history file when the workflow file is deleted."""
    path = runs_file_path(workflow_filename)
    try:
        if path.is_file():
            path.unlink()
    except OSError as e:
        logger.warning("Failed to delete workflow runs file %s: %s", path, e)


class WorkflowRunStore:
    """Serialize appends to run JSON files (single-process friendly)."""

    _instance: WorkflowRunStore | None = None
    _singleton_lock = threading.Lock()

    def __init__(self) -> None:
        self._file_lock = asyncio.Lock()

    @classmethod
    def get_instance(cls) -> WorkflowRunStore:
        with cls._singleton_lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    async def list_runs(self, workflow_filename: str) -> List[dict[str, Any]]:
        async with self._file_lock:
            return _load_list(runs_file_path(workflow_filename))

    async def append_run(
        self,
        workflow_filename: str,
        *,
        user_id: str,
        session_id: str,
        trigger: str,
        status: str | None,
        executed_at: datetime | None,
    ) -> dict[str, Any]:
        run_id = str(uuid.uuid4())
        at = executed_at or datetime.now(timezone.utc)
        if at.tzinfo is None:
            at = at.replace(tzinfo=timezone.utc)
        record: dict[str, Any] = {
            "run_id": run_id,
            "workflow_id": workflow_filename,
            "user_id": user_id,
            "session_id": session_id,
            "trigger": trigger,
            "executed_at": at.isoformat(),
        }
        if status is not None:
            record["status"] = status

        path = runs_file_path(workflow_filename)
        async with self._file_lock:
            items = _load_list(path)
            items.append(record)
            _save_atomic(path, items)
        return record

    async def get_run(
        self,
        workflow_filename: str,
        run_id: str,
    ) -> dict[str, Any] | None:
        async with self._file_lock:
            for row in _load_list(runs_file_path(workflow_filename)):
                if row.get("run_id") == run_id:
                    return row
        return None
