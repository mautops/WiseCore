# -*- coding: utf-8 -*-
"""Unit tests for config context module."""

from __future__ import annotations

from pathlib import Path

import pytest

from wisecore.config.context import (
    current_workspace_dir,
    get_current_workspace_dir,
    set_current_workspace_dir,
)


class TestCurrentWorkspaceDir:
    """Tests for workspace directory context variable."""

    def test_default_is_none(self):
        """Test that default workspace dir is None."""
        # Reset to default
        set_current_workspace_dir(None)
        assert get_current_workspace_dir() is None

    def test_set_and_get_workspace_dir(self, temp_dir: Path):
        """Test setting and getting workspace directory."""
        workspace = temp_dir / "workspace"
        workspace.mkdir()

        set_current_workspace_dir(workspace)
        result = get_current_workspace_dir()

        assert result == workspace

    def test_set_none_clears_workspace(self, temp_dir: Path):
        """Test setting None clears the workspace."""
        workspace = temp_dir / "workspace"
        workspace.mkdir()

        set_current_workspace_dir(workspace)
        assert get_current_workspace_dir() == workspace

        set_current_workspace_dir(None)
        assert get_current_workspace_dir() is None

    def test_context_var_is_contextual(self, temp_dir: Path):
        """Test that context variable is properly contextual."""
        # This test verifies the contextvars behavior
        workspace1 = temp_dir / "workspace1"
        workspace2 = temp_dir / "workspace2"
        workspace1.mkdir()
        workspace2.mkdir()

        set_current_workspace_dir(workspace1)
        assert get_current_workspace_dir() == workspace1

        set_current_workspace_dir(workspace2)
        assert get_current_workspace_dir() == workspace2

        # Reset
        set_current_workspace_dir(None)
