# -*- coding: utf-8 -*-
"""Pytest configuration and shared fixtures for Wisecore tests."""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path
from typing import Any, Generator
from unittest.mock import MagicMock, patch

import pytest

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


@pytest.fixture
def temp_dir() -> Generator[Path, None, None]:
    """Create a temporary directory for test files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def temp_working_dir(temp_dir: Path) -> Generator[Path, None, None]:
    """Create a temporary working directory with Wisecore structure."""
    working_dir = temp_dir / "working"
    working_dir.mkdir(parents=True, exist_ok=True)

    secret_dir = temp_dir / "working.secret"
    secret_dir.mkdir(parents=True, exist_ok=True)

    # Patch environment variables
    env_patch = {
        "WORKING_DIR": str(working_dir),
        "SECRET_DIR": str(secret_dir),
    }

    with patch.dict(os.environ, env_patch, clear=False):
        yield working_dir


@pytest.fixture
def mock_env() -> dict[str, str]:
    """Return a mock environment dictionary."""
    return {
        "WORKING_DIR": "/tmp/wisecore_test",
        "SECRET_DIR": "/tmp/wisecore_test.secret",
        "LOG_LEVEL": "DEBUG",
    }


@pytest.fixture
def mock_httpx_client():
    """Mock httpx client for HTTP requests."""
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {}
    mock_client.get.return_value = mock_response
    mock_client.post.return_value = mock_response
    return mock_client


@pytest.fixture
def sample_jwt_payload() -> dict[str, Any]:
    """Return a sample JWT payload for testing."""
    import time

    return {
        "sub": "user-123",
        "preferred_username": "testuser",
        "email": "test@example.com",
        "exp": int(time.time()) + 3600,
        "iat": int(time.time()),
        "aud": ["dash", "account"],
        "azp": "hi-ops",
        "scope": "openid profile email",
    }


@pytest.fixture
def sample_config_dict() -> dict[str, Any]:
    """Return a sample configuration dictionary."""
    return {
        "version": "1.0",
        "agents": {
            "defaults": {
                "active_model": {
                    "provider_id": "openai",
                    "model": "gpt-4",
                },
            },
            "profiles": {},
        },
        "security": {
            "tool_guard": {
                "enabled": True,
                "guarded_tools": ["execute_shell_command"],
            },
        },
    }


@pytest.fixture
def sample_skill_content() -> str:
    """Return sample SKILL.md content."""
    return """---
name: test-skill
description: A test skill for unit testing
version: 1.0.0
---

# Test Skill

This is a test skill for unit testing purposes.

## Usage

```
Use this skill to test the skill manager.
```
"""


@pytest.fixture
def sample_skill_files(temp_dir: Path) -> Path:
    """Create a sample skill directory structure."""
    skill_dir = temp_dir / "skills" / "test-skill"
    skill_dir.mkdir(parents=True, exist_ok=True)

    skill_md = skill_dir / "SKILL.md"
    skill_md.write_text("""---
name: test-skill
---
# Test Skill
""")

    scripts_dir = skill_dir / "scripts"
    scripts_dir.mkdir(parents=True, exist_ok=True)

    (scripts_dir / "main.py").write_text("# Test script\nprint('hello')\n")

    return skill_dir


# Markers
def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "slow: marks tests as slow")
    config.addinivalue_line("markers", "integration: marks integration tests")
    config.addinivalue_line("markers", "requires_api: requires external API access")
