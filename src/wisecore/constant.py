# -*- coding: utf-8 -*-
import os
from pathlib import Path
from dotenv import load_dotenv

# Load repo-root .env, then optional monorepo parent (e.g. hi-ops/.env).
_wisecore_root = Path(__file__).resolve().parent.parent.parent
_env_path = _wisecore_root / ".env"
if _env_path.is_file():
    load_dotenv(_env_path)
_hiops_monorepo_env = _wisecore_root.parent / ".env"
if _hiops_monorepo_env.is_file():
    load_dotenv(_hiops_monorepo_env, override=False)
# next-console Keycloak OAuth vars (same IdP as API introspection);
# root .env wins.
_next_console_env = _wisecore_root / "next-console" / ".env"
if _next_console_env.is_file():
    load_dotenv(_next_console_env, override=False)


class EnvVarLoader:
    """Utility to load and parse environment variables with type safety
    and defaults.
    """

    @staticmethod
    def get_bool(env_var: str, default: bool = False) -> bool:
        """Get a boolean environment variable,
        interpreting common truthy values."""
        val = os.environ.get(env_var, str(default)).lower()
        return val in ("true", "1", "yes")

    @staticmethod
    def get_float(
        env_var: str,
        default: float = 0.0,
        min_value: float | None = None,
        max_value: float | None = None,
        allow_inf: bool = False,
    ) -> float:
        """Get a float environment variable with optional bounds
        and infinity handling."""
        try:
            value = float(os.environ.get(env_var, str(default)))
            if min_value is not None and value < min_value:
                return min_value
            if max_value is not None and value > max_value:
                return max_value
            if not allow_inf and (
                value == float("inf") or value == float("-inf")
            ):
                return default
            return value
        except (TypeError, ValueError):
            return default

    @staticmethod
    def get_int(
        env_var: str,
        default: int = 0,
        min_value: int | None = None,
        max_value: int | None = None,
    ) -> int:
        """Get an integer environment variable with optional bounds."""
        try:
            value = int(os.environ.get(env_var, str(default)))
            if min_value is not None and value < min_value:
                return min_value
            if max_value is not None and value > max_value:
                return max_value
            return value
        except (TypeError, ValueError):
            return default

    @staticmethod
    def get_str(env_var: str, default: str = "") -> str:
        """Get a string environment variable with a default fallback."""
        return os.environ.get(env_var, default)


WORKING_DIR = (
    Path(EnvVarLoader.get_str("WORKING_DIR", "~/.wisecore"))
    .expanduser()
    .resolve()
)
SECRET_DIR = (
    Path(
        EnvVarLoader.get_str(
            "SECRET_DIR",
            f"{WORKING_DIR}.secret",
        ),
    )
    .expanduser()
    .resolve()
)

# Default media directory for channels (cross-platform)
DEFAULT_MEDIA_DIR = WORKING_DIR / "media"

JOBS_FILE = EnvVarLoader.get_str("JOBS_FILE", "jobs.json")

CHATS_FILE = EnvVarLoader.get_str("CHATS_FILE", "chats.json")

# Builtin multi-agent profile: Q&A helper.
BUILTIN_QA_AGENT_ID = "builtin_qa_agent"
BUILTIN_QA_AGENT_NAME = "QA Agent"
# Default active_skills when the builtin QA workspace is first created only.
BUILTIN_QA_AGENT_SKILL_NAMES: tuple[str, ...] = (
    "guidance",
    "source_index",
)

TOKEN_USAGE_FILE = EnvVarLoader.get_str(
    "TOKEN_USAGE_FILE",
    "token_usage.json",
)

CONFIG_FILE = EnvVarLoader.get_str("CONFIG_FILE", "config.json")

HEARTBEAT_FILE = EnvVarLoader.get_str("HEARTBEAT_FILE", "HEARTBEAT.md")
HEARTBEAT_DEFAULT_EVERY = "6h"
HEARTBEAT_DEFAULT_TARGET = "main"
HEARTBEAT_TARGET_LAST = "last"

# Debug history file for /dump_history and /load_history commands
DEBUG_HISTORY_FILE = EnvVarLoader.get_str(
    "DEBUG_HISTORY_FILE",
    "debug_history.jsonl",
)
MAX_LOAD_HISTORY_COUNT = 10000

# Env key for app log level (used by CLI and app load for reload child).
LOG_LEVEL_ENV = "LOG_LEVEL"

# Env to indicate running inside a container (e.g. Docker). Set to 1/true/yes.
RUNNING_IN_CONTAINER = EnvVarLoader.get_bool(
    "RUNNING_IN_CONTAINER",
    False,
)

# Timeout in seconds for checking if a provider is reachable.
MODEL_PROVIDER_CHECK_TIMEOUT = EnvVarLoader.get_float(
    "MODEL_PROVIDER_CHECK_TIMEOUT",
    5.0,
    min_value=0,
    allow_inf=False,
)

# Playwright: use system Chromium when set (e.g. in Docker).
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH_ENV = "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"

# When True, expose /docs, /redoc, /openapi.json
# (dev only; keep False in prod).
DOCS_ENABLED = EnvVarLoader.get_bool("OPENAPI_DOCS", False)

# Memory directory
MEMORY_DIR = WORKING_DIR / "memory"

# Custom channel modules (installed via `wisecore channels install`); manager
# loads BaseChannel subclasses from here.
CUSTOM_CHANNELS_DIR = WORKING_DIR / "custom_channels"

# Local models directory
MODELS_DIR = WORKING_DIR / "models"

# Workflows directory (user-level, supports multi-agent orchestration)
WORKFLOWS_DIR = WORKING_DIR / "workflows"
# Per-workflow run history: one JSON list file per workflow basename
WORKFLOW_RUNS_DIR = WORKFLOWS_DIR / ".runs"

MEMORY_COMPACT_KEEP_RECENT = EnvVarLoader.get_int(
    "MEMORY_COMPACT_KEEP_RECENT",
    3,
    min_value=0,
)

# Memory compaction configuration
MEMORY_COMPACT_RATIO = EnvVarLoader.get_float(
    "MEMORY_COMPACT_RATIO",
    0.7,
    min_value=0,
    allow_inf=False,
)

DASHSCOPE_BASE_URL = EnvVarLoader.get_str(
    "DASHSCOPE_BASE_URL",
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
)

# CORS configuration — comma-separated list of allowed origins.
# Example: CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
# Special values:
#   - "dev" or "development": auto-allow common dev origins (localhost:3000, localhost:5173, etc.)
#   - "*" : allow all origins (not recommended for production)
# When unset, CORS middleware is not applied.
CORS_ORIGINS = EnvVarLoader.get_str("CORS_ORIGINS", "").strip()

# LLM API retry configuration
LLM_MAX_RETRIES = EnvVarLoader.get_int(
    "LLM_MAX_RETRIES",
    3,
    min_value=0,
)

LLM_BACKOFF_BASE = EnvVarLoader.get_float(
    "LLM_BACKOFF_BASE",
    1.0,
    min_value=0.1,
)

LLM_BACKOFF_CAP = EnvVarLoader.get_float(
    "LLM_BACKOFF_CAP",
    10.0,
    min_value=0.5,
)

# Tool guard approval timeout (seconds).
try:
    TOOL_GUARD_APPROVAL_TIMEOUT_SECONDS = max(
        float(
            os.environ.get("TOOL_GUARD_APPROVAL_TIMEOUT_SECONDS", "600"),
        ),
        1.0,
    )
except (TypeError, ValueError):
    TOOL_GUARD_APPROVAL_TIMEOUT_SECONDS = 600.0
