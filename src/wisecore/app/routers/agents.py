# -*- coding: utf-8 -*-
"""Multi-agent management API.

Provides RESTful API for managing multiple agent instances.
"""

import asyncio
import json
import logging
import shutil
from pathlib import Path
from fastapi import APIRouter, Body, HTTPException, Request
from fastapi import Path as PathParam
from pydantic import BaseModel

from ...config.config import (
    AgentProfileConfig,
    AgentProfileRef,
    load_agent_config,
    save_agent_config,
    generate_short_agent_id,
)
from ...config.utils import load_config, save_config
from ...agents.memory.agent_md_manager import AgentMdManager
from ...agents.skills_manager import (
    prune_active_skills,
    sync_skills_to_working_dir,
)
from ...agents.utils import copy_builtin_qa_md_files
from ..agent_tenancy import (
    ensure_agent_allowed_for_request,
    list_profile_ids_for_subject,
    workspace_dir_owned_by_subject,
)
from ..multi_agent_manager import MultiAgentManager
from ..user_primary_agent import user_agent_binding_enabled
from ...constant import BUILTIN_QA_AGENT_ID, WORKING_DIR

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agents", tags=["agents"])


class AgentSummary(BaseModel):
    """Agent summary information."""

    id: str
    name: str
    description: str
    workspace_dir: str
    is_builtin: bool = False


class AgentListResponse(BaseModel):
    """Response for listing agents."""

    agents: list[AgentSummary]


class CreateAgentRequest(BaseModel):
    """Request model for creating a new agent (id is auto-generated)."""

    name: str
    description: str = ""
    workspace_dir: str | None = None
    language: str = "en"


class MdFileInfo(BaseModel):
    """Markdown file metadata."""

    filename: str
    path: str
    size: int
    created_time: str
    modified_time: str


class MdFileContent(BaseModel):
    """Markdown file content."""

    content: str


def _get_multi_agent_manager(request: Request) -> MultiAgentManager:
    """Get MultiAgentManager from app state."""
    if not hasattr(request.app.state, "multi_agent_manager"):
        raise HTTPException(
            status_code=500,
            detail="MultiAgentManager not initialized",
        )
    return request.app.state.multi_agent_manager


def _read_profile_description(workspace_dir: str) -> str:
    """Read description from PROFILE.md if exists.

    Extracts identity section from PROFILE.md as fallback description.

    Args:
        workspace_dir: Path to agent workspace

    Returns:
        Description text from PROFILE.md, or empty string if not found
    """
    try:
        profile_path = Path(workspace_dir) / "PROFILE.md"
        if not profile_path.exists():
            return ""

        content = profile_path.read_text(encoding="utf-8")
        lines = []
        in_identity = False

        for line in content.split("\n"):
            if line.strip().startswith("## 身份") or line.strip().startswith(
                "## Identity",
            ):
                in_identity = True
                continue
            if in_identity:
                if line.strip().startswith("##"):
                    break
                if line.strip() and not line.strip().startswith("#"):
                    lines.append(line.strip())

        return " ".join(lines)[:200] if lines else ""
    except Exception:  # noqa: E722
        return ""


@router.get(
    "",
    response_model=AgentListResponse,
    summary="List all agents",
    description="Get list of all configured agents",
)
async def list_agents(request: Request) -> AgentListResponse:
    """List agents; tenants only see profiles under their workspace tree."""
    config = load_config()

    allowed_ids: set[str] | None = None
    raw_sub = getattr(request.state, "wisecore_subject", None)
    if raw_sub and isinstance(raw_sub, str) and raw_sub.strip():
        allowed_ids = list_profile_ids_for_subject(raw_sub.strip())
        # Always include default and builtin agents for every user
        allowed_ids.add("default")
        allowed_ids.add(BUILTIN_QA_AGENT_ID)

    agents = []
    for agent_id, agent_ref in config.agents.profiles.items():
        if allowed_ids is not None and agent_id not in allowed_ids:
            continue
        # Load agent config to get name and description
        try:
            agent_config = load_agent_config(agent_id)
            description = agent_config.description or ""

            # Always read PROFILE.md and append/merge
            profile_desc = _read_profile_description(agent_ref.workspace_dir)
            if profile_desc:
                if description.strip():
                    # Both exist: merge with separator
                    description = f"{description.strip()} | {profile_desc}"
                else:
                    # Only PROFILE.md exists
                    description = profile_desc

            agents.append(
                AgentSummary(
                    id=agent_id,
                    name=agent_config.name,
                    description=description,
                    workspace_dir=agent_ref.workspace_dir,
                    is_builtin=agent_id == BUILTIN_QA_AGENT_ID,
                ),
            )
        except Exception:  # noqa: E722
            # If agent config load fails, use basic info
            agents.append(
                AgentSummary(
                    id=agent_id,
                    name=agent_id.title(),
                    description="",
                    workspace_dir=agent_ref.workspace_dir,
                    is_builtin=agent_id == BUILTIN_QA_AGENT_ID,
                ),
            )

    return AgentListResponse(
        agents=agents,
    )


@router.get(
    "/{agentId}",
    response_model=AgentProfileConfig,
    summary="Get agent details",
    description="Get complete configuration for a specific agent",
)
async def get_agent(
    request: Request,
    agentId: str = PathParam(...),
) -> AgentProfileConfig:
    """Get agent configuration."""
    ensure_agent_allowed_for_request(request, agentId)
    try:
        agent_config = load_agent_config(agentId)
        return agent_config
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


def provision_new_agent(
    *,
    name: str,
    description: str = "",
    workspace_dir: str | None = None,
    language: str = "en",
    owner_segment: str | None = None,
) -> AgentProfileRef:
    """Create a new agent with auto-generated ID and persist config."""
    config = load_config()

    max_attempts = 10
    new_id = None
    for _ in range(max_attempts):
        candidate_id = generate_short_agent_id()
        if candidate_id not in config.agents.profiles:
            new_id = candidate_id
            break

    if new_id is None:
        raise RuntimeError(
            "Failed to generate unique agent ID after 10 attempts",
        )

    if workspace_dir is not None:
        ws = Path(workspace_dir).expanduser()
    elif owner_segment:
        ws = Path(WORKING_DIR) / "workspaces" / owner_segment / new_id
    else:
        ws = Path(WORKING_DIR) / "workspaces" / new_id
    ws.mkdir(parents=True, exist_ok=True)

    from ...config.config import (
        ChannelConfig,
        MCPConfig,
        HeartbeatConfig,
        ToolsConfig,
    )

    agent_config = AgentProfileConfig(
        id=new_id,
        name=name,
        description=description,
        workspace_dir=str(ws),
        language=language,
        channels=ChannelConfig(),
        mcp=MCPConfig(),
        heartbeat=HeartbeatConfig(),
        tools=ToolsConfig(),
    )

    _initialize_agent_workspace(ws, agent_config)

    agent_ref = AgentProfileRef(
        id=new_id,
        workspace_dir=str(ws),
    )

    config.agents.profiles[new_id] = agent_ref
    save_config(config)
    save_agent_config(new_id, agent_config)

    logger.info("Created new agent: %s (name=%s)", new_id, name)
    return agent_ref


@router.post(
    "",
    response_model=AgentProfileRef,
    status_code=201,
    summary="Create new agent",
    description="Create a new agent (ID is auto-generated by server)",
)
async def create_agent(
    http_request: Request,
    body: CreateAgentRequest = Body(...),
) -> AgentProfileRef:
    """Create a new agent with auto-generated ID."""
    owner = getattr(http_request.state, "wisecore_subject", None)
    owner_segment = owner if body.workspace_dir is None else None
    if (
        user_agent_binding_enabled()
        and owner
        and isinstance(owner, str)
        and owner.strip()
        and body.workspace_dir
    ):
        if not workspace_dir_owned_by_subject(
            body.workspace_dir,
            owner.strip(),
        ):
            raise HTTPException(
                status_code=403,
                detail="workspace_dir must be under your agent workspace tree",
            )
    try:
        return provision_new_agent(
            name=body.name,
            description=body.description,
            workspace_dir=body.workspace_dir,
            language=body.language,
            owner_segment=owner_segment,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put(
    "/{agentId}",
    response_model=AgentProfileConfig,
    summary="Update agent",
    description="Update agent configuration and trigger reload",
)
async def update_agent(
    request: Request,
    agentId: str = PathParam(...),
    agent_config: AgentProfileConfig = Body(...),
) -> AgentProfileConfig:
    """Update agent configuration."""
    ensure_agent_allowed_for_request(request, agentId)
    config = load_config()

    if agentId not in config.agents.profiles:
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{agentId}' not found",
        )

    # Load existing complete configuration
    existing_config = load_agent_config(agentId)

    # Merge updates: only update fields that are explicitly set
    update_data = agent_config.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key != "id":
            setattr(existing_config, key, value)

    # Ensure ID doesn't change
    existing_config.id = agentId

    raw_sub = getattr(request.state, "wisecore_subject", None)
    if (
        user_agent_binding_enabled()
        and raw_sub
        and isinstance(raw_sub, str)
        and raw_sub.strip()
    ):
        if not workspace_dir_owned_by_subject(
            existing_config.workspace_dir,
            raw_sub.strip(),
        ):
            raise HTTPException(
                status_code=403,
                detail=(
                    "workspace_dir must stay under your agent workspace tree"
                ),
            )

    # Save merged configuration
    save_agent_config(agentId, existing_config)

    # Trigger hot reload if agent is running (async, non-blocking)
    # IMPORTANT: Get manager before creating background task to avoid
    # accessing request object after its lifecycle ends
    manager = _get_multi_agent_manager(request)

    async def reload_in_background():
        try:
            await manager.reload_agent(agentId)
        except Exception as e:
            logger.warning(f"Background reload failed for {agentId}: {e}")

    asyncio.create_task(reload_in_background())

    return agent_config


@router.delete(
    "/{agentId}",
    summary="Delete agent",
    description=(
        "Delete agent and workspace "
        "(cannot delete default or builtin QA agent)"
    ),
)
async def delete_agent(
    request: Request,
    agentId: str = PathParam(...),
) -> dict:
    """Delete an agent."""
    ensure_agent_allowed_for_request(request, agentId)
    config = load_config()

    if agentId not in config.agents.profiles:
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{agentId}' not found",
        )

    if agentId == "default":
        raise HTTPException(
            status_code=400,
            detail="Cannot delete the default agent",
        )

    if agentId == BUILTIN_QA_AGENT_ID:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete the builtin QA agent",
        )

    # Stop agent instance if running
    manager = _get_multi_agent_manager(request)
    await manager.stop_agent(agentId)

    # Remove from config
    del config.agents.profiles[agentId]
    save_config(config)

    # Note: We don't delete the workspace directory for safety
    # Users can manually delete it if needed

    return {"success": True, "agent_id": agentId}


@router.get(
    "/{agentId}/files",
    response_model=list[MdFileInfo],
    summary="List agent workspace files",
    description="List all markdown files in agent's workspace",
)
async def list_agent_files(
    request: Request,
    agentId: str = PathParam(...),
) -> list[MdFileInfo]:
    """List agent workspace files."""
    ensure_agent_allowed_for_request(request, agentId)
    manager = _get_multi_agent_manager(request)

    try:
        workspace = await manager.get_agent(agentId)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    workspace_manager = AgentMdManager(str(workspace.workspace_dir))

    try:
        files = [
            MdFileInfo.model_validate(file)
            for file in workspace_manager.list_working_mds()
        ]
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get(
    "/{agentId}/files/{filename}",
    response_model=MdFileContent,
    summary="Read agent workspace file",
    description="Read a markdown file from agent's workspace",
)
async def read_agent_file(
    request: Request,
    agentId: str = PathParam(...),
    filename: str = PathParam(...),
) -> MdFileContent:
    """Read agent workspace file."""
    ensure_agent_allowed_for_request(request, agentId)
    manager = _get_multi_agent_manager(request)

    try:
        workspace = await manager.get_agent(agentId)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    workspace_manager = AgentMdManager(str(workspace.workspace_dir))

    try:
        content = workspace_manager.read_working_md(filename)
        return MdFileContent(content=content)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=f"File '{filename}' not found",
        ) from exc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put(
    "/{agentId}/files/{filename}",
    response_model=dict,
    summary="Write agent workspace file",
    description="Create or update a markdown file in agent's workspace",
)
async def write_agent_file(
    request: Request,
    agentId: str = PathParam(...),
    filename: str = PathParam(...),
    file_content: MdFileContent = Body(...),
) -> dict:
    """Write agent workspace file."""
    ensure_agent_allowed_for_request(request, agentId)
    manager = _get_multi_agent_manager(request)

    try:
        workspace = await manager.get_agent(agentId)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    workspace_manager = AgentMdManager(str(workspace.workspace_dir))

    try:
        workspace_manager.write_working_md(filename, file_content.content)
        return {"written": True, "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get(
    "/{agentId}/memory",
    response_model=list[MdFileInfo],
    summary="List agent memory files",
    description="List all memory files for an agent",
)
async def list_agent_memory(
    request: Request,
    agentId: str = PathParam(...),
) -> list[MdFileInfo]:
    """List agent memory files."""
    ensure_agent_allowed_for_request(request, agentId)
    manager = _get_multi_agent_manager(request)

    try:
        workspace = await manager.get_agent(agentId)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    workspace_manager = AgentMdManager(str(workspace.workspace_dir))

    try:
        files = [
            MdFileInfo.model_validate(file)
            for file in workspace_manager.list_memory_mds()
        ]
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


def _ensure_default_heartbeat_md(workspace_dir: Path, language: str) -> None:
    """Write a default HEARTBEAT.md when the workspace has none."""
    heartbeat_file = workspace_dir / "HEARTBEAT.md"
    if heartbeat_file.exists():
        return
    default_by_lang = {
        "zh": """# Heartbeat checklist
- 扫描收件箱紧急邮件
- 查看未来 2h 的日历
- 检查待办是否卡住
- 若安静超过 8h，轻量 check-in
""",
        "en": """# Heartbeat checklist
- Scan inbox for urgent email
- Check calendar for next 2h
- Check tasks for blockers
- Light check-in if quiet for 8h
""",
        "ru": """# Heartbeat checklist
- Проверить входящие на срочные письма
- Просмотреть календарь на ближайшие 2 часа
- Проверить задачи на наличие блокировок
- Лёгкая проверка при отсутствии активности более 8 часов
""",
    }
    content = default_by_lang.get(language, default_by_lang["en"])
    with open(heartbeat_file, "w", encoding="utf-8") as f:
        f.write(content.strip())


def _initialize_agent_workspace(  # pylint: disable=too-many-branches
    workspace_dir: Path,
    agent_config: AgentProfileConfig,  # pylint: disable=unused-argument
    *,
    active_skill_names: list[str] | None = None,
    builtin_qa_md_seed: bool = False,
) -> None:
    """Initialize agent workspace (similar to wisecore init --defaults).

    Args:
        workspace_dir: Path to agent workspace
        agent_config: Agent configuration (reserved for future use)
        active_skill_names: If set, only these skills are synced to
            ``active_skills``; others are removed. If ``None``, copy all
            builtin skills when missing (default for new agents).
        builtin_qa_md_seed: If True, seed the builtin QA persona from
            ``md_files/qa/<lang>/`` (AGENTS, PROFILE, SOUL), copy MEMORY and
            HEARTBEAT from the normal language pack, and **omit** BOOTSTRAP.md
            so bootstrap mode never triggers.
    """
    from ...config import load_config as load_global_config

    workspace_dir = Path(workspace_dir).expanduser()

    # Create essential subdirectories
    (workspace_dir / "sessions").mkdir(exist_ok=True)
    (workspace_dir / "memory").mkdir(exist_ok=True)
    (workspace_dir / "active_skills").mkdir(exist_ok=True)
    (workspace_dir / "customized_skills").mkdir(exist_ok=True)

    # Get language from global config
    config = load_global_config()
    language = config.agents.language or "zh"

    package_agents_root = Path(__file__).parent.parent.parent / "agents"
    md_files_dir = package_agents_root / "md_files" / language

    if builtin_qa_md_seed:
        copy_builtin_qa_md_files(
            language,
            workspace_dir,
            only_if_missing=True,
        )
    elif md_files_dir.exists():
        for md_file in md_files_dir.glob("*.md"):
            target_file = workspace_dir / md_file.name
            if not target_file.exists():
                try:
                    shutil.copy2(md_file, target_file)
                except Exception as e:
                    logger.warning(
                        f"Failed to copy {md_file.name}: {e}",
                    )

    _ensure_default_heartbeat_md(workspace_dir, language)

    builtin_skills_dir = package_agents_root / "skills"
    if active_skill_names is not None:
        synced, skipped = sync_skills_to_working_dir(
            workspace_dir,
            skill_names=active_skill_names,
            force=True,
        )
        logger.debug(
            "Synced skills for %s: synced=%s skipped=%s names=%s",
            workspace_dir,
            synced,
            skipped,
            active_skill_names,
        )
        prune_active_skills(workspace_dir, set(active_skill_names))
    elif builtin_skills_dir.exists():
        for skill_dir in builtin_skills_dir.iterdir():
            if skill_dir.is_dir() and (skill_dir / "SKILL.md").exists():
                target_skill_dir = (
                    workspace_dir / "active_skills" / skill_dir.name
                )
                if not target_skill_dir.exists():
                    try:
                        shutil.copytree(skill_dir, target_skill_dir)
                    except Exception as e:
                        logger.warning(
                            f"Failed to copy skill {skill_dir.name}: {e}",
                        )

    # Create empty jobs.json for cron jobs
    jobs_file = workspace_dir / "jobs.json"
    if not jobs_file.exists():
        with open(jobs_file, "w", encoding="utf-8") as f:
            json.dump(
                {"version": 1, "jobs": []},
                f,
                ensure_ascii=False,
                indent=2,
            )

    # Create empty chats.json for chat history
    chats_file = workspace_dir / "chats.json"
    if not chats_file.exists():
        with open(chats_file, "w", encoding="utf-8") as f:
            json.dump(
                {"version": 1, "chats": []},
                f,
                ensure_ascii=False,
                indent=2,
            )

    # Create empty token_usage.json
    token_usage_file = workspace_dir / "token_usage.json"
    if not token_usage_file.exists():
        with open(token_usage_file, "w", encoding="utf-8") as f:
            f.write("[]")
