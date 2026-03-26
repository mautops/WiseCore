# -*- coding: utf-8 -*-
"""Pytest configuration for integration tests.

Provides fixtures for integration testing including:
- Test application instances
- Database connections
- Mock external services
"""

from __future__ import annotations

import asyncio
import os
import tempfile
from pathlib import Path
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for async tests."""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def integration_temp_dir() -> Generator[Path, None, None]:
    """Create a temporary directory for integration tests."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def integration_env(integration_temp_dir: Path) -> Generator[dict, None, None]:
    """Set up environment variables for integration tests."""
    working_dir = integration_temp_dir / "working"
    secret_dir = integration_temp_dir / "working.secret"
    working_dir.mkdir(parents=True, exist_ok=True)
    secret_dir.mkdir(parents=True, exist_ok=True)

    env_vars = {
        "WORKING_DIR": str(working_dir),
        "SECRET_DIR": str(secret_dir),
        "AUTH_ENABLED": "false",
        "LOG_LEVEL": "WARNING",
    }

    with patch.dict(os.environ, env_vars, clear=False):
        yield env_vars


@pytest.fixture
async def test_app(integration_env: dict):
    """Create a test application instance."""
    # Import here to avoid circular imports
    from wisecore.app._app import create_app
    from fastapi.testclient import TestClient

    app = create_app()

    async with TestClient(app) as client:
        yield client


@pytest.fixture
def mock_http_client():
    """Mock HTTP client for external API calls."""
    mock = AsyncMock()
    mock.get = AsyncMock()
    mock.post = AsyncMock()
    mock.get.return_value = MagicMock(status_code=200, json=lambda: {})
    mock.post.return_value = MagicMock(status_code=200, json=lambda: {})
    return mock


@pytest.fixture
def mock_llm_response():
    """Mock LLM response for agent tests."""
    return {
        "content": "This is a test response from the LLM.",
        "role": "assistant",
    }
