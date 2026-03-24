# -*- coding: utf-8 -*-
"""Workflows API: Markdown under ``WORKFLOWS_DIR/<user>/`` only."""

from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ...constant import WORKFLOWS_DIR
from .md_meta import extract_meta_fields, split_frontmatter
from .run_store import WorkflowRunStore, delete_runs_file

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflows", tags=["workflows"])

_MARKDOWN_NAMES = frozenset({".md", ".markdown"})
_UUID_SEGMENT = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.I,
)


def _sanitize_username(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        raise HTTPException(
            status_code=400, detail="invalid workflow username"
        )
    if len(s) > 256:
        raise HTTPException(
            status_code=400, detail="workflow username too long"
        )
    if "@" in s:
        raise HTTPException(
            status_code=400, detail="invalid workflow username"
        )
    if re.search(r"[\x00-\x1f/\\\\]", s):
        raise HTTPException(
            status_code=400, detail="invalid workflow username"
        )
    if ".." in s:
        raise HTTPException(
            status_code=400, detail="invalid workflow username"
        )
    if _UUID_SEGMENT.match(s):
        raise HTTPException(
            status_code=400, detail="invalid workflow username"
        )
    return s


def _workspace_username(request: Request) -> str:
    raw = getattr(request.state, "user", None)
    if raw is None:
        raise HTTPException(status_code=401, detail="unauthenticated")
    s = str(raw).strip()
    if not s:
        raise HTTPException(status_code=401, detail="unauthenticated")
    return _sanitize_username(s)


def _user_root(request: Request) -> Path:
    return WORKFLOWS_DIR / _workspace_username(request)


def _validate_rel_filename(name: str) -> str:
    n = name.strip().replace("\\", "/").strip("/")
    if not n or n.startswith(".."):
        raise HTTPException(status_code=400, detail="invalid filename")
    parts = [p for p in n.split("/") if p]
    if not parts:
        raise HTTPException(status_code=400, detail="invalid filename")
    for part in parts:
        if not part or part.startswith(".") or ".." in part:
            raise HTTPException(status_code=400, detail="invalid filename")
        if re.search(r"[\x00-\x1f]", part):
            raise HTTPException(status_code=400, detail="invalid filename")
    low = parts[-1].lower()
    if not any(low.endswith(ext) for ext in _MARKDOWN_NAMES):
        raise HTTPException(
            status_code=400,
            detail="filename must end with .md or .markdown",
        )
    return n


def _resolve_workflow_file(request: Request, filename: str) -> Path:
    fn = _validate_rel_filename(filename)
    ud = _user_root(request)
    if not ud.is_dir():
        raise HTTPException(status_code=404, detail="workflow not found")
    ud_r = ud.resolve()
    path = (ud / fn).resolve()
    try:
        path.relative_to(ud_r)
    except ValueError:
        raise HTTPException(
            status_code=404, detail="workflow not found"
        ) from None
    if path.is_file():
        return path
    raise HTTPException(status_code=404, detail="workflow not found")


def _iso_ts(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def _iter_user_markdown_files(user_root: Path) -> list[Path]:
    if not user_root.is_dir():
        return []
    ud_r = user_root.resolve()
    out: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(
        user_root,
        topdown=True,
        followlinks=True,
    ):
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        for name in filenames:
            if name.startswith("."):
                continue
            suf = Path(name).suffix.lower()
            if suf not in _MARKDOWN_NAMES:
                continue
            p = Path(dirpath) / name
            try:
                if not p.is_file():
                    continue
            except OSError:
                continue
            try:
                rel = p.resolve().relative_to(ud_r)
            except ValueError:
                continue
            if any(part.startswith(".") for part in rel.parts):
                continue
            out.append(p)
    return sorted(out, key=lambda x: x.resolve().as_posix().lower())


class WorkflowMetaInfo(BaseModel):
    """Metadata from YAML frontmatter."""

    name: Optional[str] = None
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    category: Optional[str] = None
    status: Optional[str] = None
    version: Optional[str] = None


class WorkflowInfo(BaseModel):
    """Workflow file information."""

    filename: str
    path: str
    size: int
    created_time: str
    modified_time: str
    name: Optional[str] = None
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    category: Optional[str] = None
    status: Optional[str] = None
    version: Optional[str] = None


class WorkflowContent(BaseModel):
    """Request body: full file content as stored."""

    content: str = Field(
        ...,
        description="Full Markdown file (may include frontmatter)",
    )


class WorkflowReadResponse(BaseModel):
    """Workflow file: rendered body, raw file, and parsed frontmatter meta."""

    content: str = Field(
        ...,
        description="Markdown body after frontmatter (or full file if none)",
    )
    raw: str = Field(..., description="Exact file contents as on disk")
    meta: WorkflowMetaInfo


class WorkflowListResponse(BaseModel):
    """Response for listing workflows."""

    workflows: List[WorkflowInfo]


class WorkflowCreateRequest(BaseModel):
    """Request for creating a workflow."""

    filename: str = Field(
        ...,
        description=(
            "Relative path under your workflows dir (e.g. daily_report.md)"
        ),
    )
    content: str = Field(
        ...,
        description="Workflow content in Markdown format",
    )


class WorkflowRunCreate(BaseModel):
    """Append one execution record for a workflow."""

    user_id: str = Field(default="", max_length=512)
    session_id: str = Field(default="", max_length=512)
    trigger: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="How the run was started (e.g. api, cron, manual)",
    )
    status: Optional[str] = Field(
        None,
        max_length=64,
        description="Optional outcome hint (e.g. success, error)",
    )
    executed_at: Optional[datetime] = Field(
        None,
        description="Defaults to current UTC if omitted",
    )


class WorkflowRunOut(BaseModel):
    """One persisted workflow run row."""

    run_id: str
    workflow_id: str
    user_id: str = ""
    session_id: str = ""
    trigger: str
    executed_at: str
    status: Optional[str] = None


class WorkflowRunListResponse(BaseModel):
    """List of run records for one workflow (newest first)."""

    runs: List[WorkflowRunOut]


def _read_workflow_text(file_path: Path) -> str:
    return file_path.read_text(encoding="utf-8")


def _meta_for_raw(raw: str) -> WorkflowMetaInfo:
    _had, meta_dict, _body, _full = split_frontmatter(raw)
    name, description, tags, category, status, version = extract_meta_fields(
        meta_dict,
    )
    return WorkflowMetaInfo(
        name=name,
        description=description,
        tags=tags,
        category=category,
        status=status,
        version=version,
    )


def _info_from_path(
    file_path: Path,
    username: str,
    rel: str,
) -> WorkflowInfo:
    stat = file_path.stat()
    created = float(getattr(stat, "st_birthtime", stat.st_ctime))
    try:
        raw = _read_workflow_text(file_path)
        wmeta = _meta_for_raw(raw)
    except OSError as e:
        logger.warning("Failed to read workflow %s: %s", file_path, e)
        wmeta = WorkflowMetaInfo()

    return WorkflowInfo(
        filename=rel,
        path=f"{username}/{rel}",
        size=stat.st_size,
        created_time=_iso_ts(created),
        modified_time=_iso_ts(stat.st_mtime),
        name=wmeta.name,
        description=wmeta.description,
        tags=wmeta.tags,
        category=wmeta.category,
        status=wmeta.status,
        version=wmeta.version,
    )


@router.get(
    "",
    response_model=WorkflowListResponse,
    summary="List all workflows",
    description=("Markdown under ``workflows/<user>/`` directory (recursive)"),
)
async def list_workflows(request: Request) -> WorkflowListResponse:
    uname = _workspace_username(request)
    ud = WORKFLOWS_DIR / uname
    if not ud.is_dir():
        return WorkflowListResponse(workflows=[])
    ud_r = ud.resolve()
    workflows: list[WorkflowInfo] = []
    for file_path in _iter_user_markdown_files(ud):
        try:
            rel = file_path.resolve().relative_to(ud_r).as_posix()
            workflows.append(_info_from_path(file_path, uname, rel))
        except OSError as e:
            logger.warning("list_workflows skip %s: %s", file_path, e)
    return WorkflowListResponse(workflows=workflows)


@router.get(
    "/{filename:path}/runs/{run_id}",
    response_model=WorkflowRunOut,
    summary="Get one workflow run record",
)
async def get_workflow_run(
    request: Request,
    filename: str,
    run_id: str,
) -> WorkflowRunOut:
    _resolve_workflow_file(request, filename)
    uname = _workspace_username(request)
    fn = _validate_rel_filename(filename)
    store = WorkflowRunStore.get_instance()
    row = await store.get_run(uname, fn, run_id)
    if row is None:
        raise HTTPException(
            status_code=404,
            detail=f"Run '{run_id}' not found for workflow '{filename}'",
        )
    return WorkflowRunOut.model_validate(row)


@router.get(
    "/{filename:path}/runs",
    response_model=WorkflowRunListResponse,
    summary="List workflow run history",
)
async def list_workflow_runs(
    request: Request,
    filename: str,
) -> WorkflowRunListResponse:
    _resolve_workflow_file(request, filename)
    uname = _workspace_username(request)
    fn = _validate_rel_filename(filename)
    store = WorkflowRunStore.get_instance()
    raw = await store.list_runs(uname, fn)
    ordered = list(reversed(raw))
    runs = [WorkflowRunOut.model_validate(r) for r in ordered]
    return WorkflowRunListResponse(runs=runs)


@router.post(
    "/{filename:path}/runs",
    response_model=WorkflowRunOut,
    status_code=201,
    summary="Append a workflow run record",
)
async def append_workflow_run(
    request: Request,
    filename: str,
    body: WorkflowRunCreate,
) -> WorkflowRunOut:
    _resolve_workflow_file(request, filename)
    uname = _workspace_username(request)
    fn = _validate_rel_filename(filename)
    store = WorkflowRunStore.get_instance()
    row = await store.append_run(
        uname,
        fn,
        user_id=body.user_id.strip() or uname,
        session_id=body.session_id,
        trigger=body.trigger,
        status=body.status,
        executed_at=body.executed_at,
    )
    return WorkflowRunOut.model_validate(row)


@router.get(
    "/{filename:path}",
    response_model=WorkflowReadResponse,
    summary="Get workflow content",
    description=(
        "Read workflow: raw file, body without frontmatter, and parsed meta"
    ),
)
async def get_workflow(
    request: Request, filename: str
) -> WorkflowReadResponse:
    file_path = _resolve_workflow_file(request, filename)

    try:
        raw = _read_workflow_text(file_path)
        had_fence, meta_dict, body, _ = split_frontmatter(raw)
        (
            name,
            description,
            tags,
            category,
            status,
            version,
        ) = extract_meta_fields(
            meta_dict,
        )
        meta = WorkflowMetaInfo(
            name=name,
            description=description,
            tags=tags,
            category=category,
            status=status,
            version=version,
        )
        display_body = body if had_fence else raw
        return WorkflowReadResponse(
            content=display_body,
            raw=raw,
            meta=meta,
        )
    except Exception as e:
        logger.error("Failed to read workflow %s: %s", filename, e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read workflow: {e}",
        ) from e


@router.post(
    "",
    status_code=201,
    summary="Create workflow",
    description="Create a new workflow file under your user directory",
)
async def create_workflow(
    request: Request,
    body: WorkflowCreateRequest,
) -> dict:
    uname = _workspace_username(request)
    rel = _validate_rel_filename(body.filename)
    udir = WORKFLOWS_DIR / uname
    target = (udir / rel).resolve()
    try:
        target.relative_to(udir.resolve())
    except ValueError:
        raise HTTPException(
            status_code=400, detail="invalid filename"
        ) from None

    if target.exists():
        raise HTTPException(
            status_code=409,
            detail=f"Workflow '{body.filename}' already exists",
        )

    try:
        udir.mkdir(parents=True, exist_ok=True)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(body.content, encoding="utf-8")
        logger.info("Created workflow: %s", target)
        return {
            "success": True,
            "filename": rel,
            "path": f"{uname}/{rel}",
        }
    except Exception as e:
        logger.error("Failed to create workflow %s: %s", body.filename, e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create workflow: {e}",
        ) from e


@router.put(
    "/{filename:path}",
    summary="Update workflow",
    description="Update an existing workflow file",
)
async def update_workflow(
    request: Request,
    filename: str,
    content: WorkflowContent,
) -> dict:
    file_path = _resolve_workflow_file(request, filename)
    fn = _validate_rel_filename(filename)

    try:
        file_path.write_text(content.content, encoding="utf-8")
        logger.info("Updated workflow: %s", file_path)
        return {
            "success": True,
            "filename": fn,
            "path": f"{_workspace_username(request)}/{fn}",
        }
    except Exception as e:
        logger.error("Failed to update workflow %s: %s", filename, e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update workflow: {e}",
        ) from e


@router.delete(
    "/{filename:path}",
    summary="Delete workflow",
    description="Delete a workflow file",
)
async def delete_workflow(request: Request, filename: str) -> dict:
    file_path = _resolve_workflow_file(request, filename)
    fn = _validate_rel_filename(filename)
    uname = _workspace_username(request)

    try:
        file_path.unlink()
        delete_runs_file(uname, fn)
        logger.info("Deleted workflow: %s", file_path)
        return {
            "success": True,
            "filename": fn,
        }
    except Exception as e:
        logger.error("Failed to delete workflow %s: %s", filename, e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete workflow: {e}",
        ) from e
