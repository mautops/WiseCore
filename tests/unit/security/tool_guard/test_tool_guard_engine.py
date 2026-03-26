# -*- coding: utf-8 -*-
"""Unit tests for tool guard engine."""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest

from wisecore.security.tool_guard.engine import ToolGuardEngine, _guard_enabled, get_guard_engine
from wisecore.security.tool_guard.models import GuardFinding, GuardSeverity, GuardThreatCategory


class TestGuardEnabled:
    """Tests for _guard_enabled function."""

    def test_guard_enabled_from_env_true(self):
        """Test guard enabled from environment variable (true)."""
        with patch.dict(os.environ, {"TOOL_GUARD_ENABLED": "true"}, clear=False):
            assert _guard_enabled() is True

    def test_guard_enabled_from_env_false(self):
        """Test guard enabled from environment variable (false)."""
        with patch.dict(os.environ, {"TOOL_GUARD_ENABLED": "false"}, clear=False):
            assert _guard_enabled() is False

    def test_guard_enabled_from_env_yes(self):
        """Test guard enabled from environment variable (yes)."""
        with patch.dict(os.environ, {"TOOL_GUARD_ENABLED": "yes"}, clear=False):
            assert _guard_enabled() is True

    def test_guard_enabled_from_env_1(self):
        """Test guard enabled from environment variable (1)."""
        with patch.dict(os.environ, {"TOOL_GUARD_ENABLED": "1"}, clear=False):
            assert _guard_enabled() is True


class TestToolGuardEngine:
    """Tests for ToolGuardEngine class."""

    def test_engine_default_initialization(self):
        """Test engine initializes with default guardians."""
        engine = ToolGuardEngine()
        assert engine.enabled is True  # Default is True
        assert len(engine._guardians) > 0

    def test_engine_disabled(self):
        """Test engine with disabled guarding."""
        engine = ToolGuardEngine(enabled=False)
        assert engine.enabled is False

    def test_engine_with_custom_guardians(self):
        """Test engine with custom guardians."""
        mock_guardian = MagicMock()
        mock_guardian.name = "test_guardian"
        mock_guardian.always_run = False
        mock_guardian.guard.return_value = []

        engine = ToolGuardEngine(guardians=[mock_guardian], enabled=True)

        assert len(engine._guardians) == 1
        assert engine.guardian_names == ["test_guardian"]

    def test_register_guardian(self):
        """Test registering a new guardian."""
        engine = ToolGuardEngine(enabled=True)
        initial_count = len(engine._guardians)

        mock_guardian = MagicMock()
        mock_guardian.name = "new_guardian"
        mock_guardian.always_run = False

        engine.register_guardian(mock_guardian)

        assert len(engine._guardians) == initial_count + 1
        assert "new_guardian" in engine.guardian_names

    def test_unregister_guardian(self):
        """Test unregistering a guardian."""
        mock_guardian = MagicMock()
        mock_guardian.name = "removable"
        mock_guardian.always_run = False

        engine = ToolGuardEngine(guardians=[mock_guardian], enabled=True)
        assert "removable" in engine.guardian_names

        result = engine.unregister_guardian("removable")

        assert result is True
        assert "removable" not in engine.guardian_names

    def test_unregister_nonexistent_guardian(self):
        """Test unregistering a nonexistent guardian."""
        engine = ToolGuardEngine(enabled=True)
        result = engine.unregister_guardian("nonexistent")
        assert result is False

    def test_guard_returns_none_when_disabled(self):
        """Test guard returns None when disabled."""
        engine = ToolGuardEngine(enabled=False)
        result = engine.guard("some_tool", {"param": "value"})

        assert result is None

    def test_guard_aggregates_findings(self):
        """Test guard aggregates findings from all guardians."""
        finding = GuardFinding(
            id="test-finding",
            rule_id="RULE_001",
            category=GuardThreatCategory.COMMAND_INJECTION,
            severity=GuardSeverity.HIGH,
            title="Test Finding",
            description="A test finding",
            tool_name="test_tool",
        )

        mock_guardian = MagicMock()
        mock_guardian.name = "test_guardian"
        mock_guardian.always_run = False
        mock_guardian.guard.return_value = [finding]

        engine = ToolGuardEngine(guardians=[mock_guardian], enabled=True)
        result = engine.guard("test_tool", {"param": "value"})

        assert result is not None
        assert result.tool_name == "test_tool"
        assert result.findings_count == 1
        assert result.is_safe is False
        assert "test_guardian" in result.guardians_used

    def test_guard_handles_guardian_failure(self):
        """Test guard handles guardian exceptions gracefully."""
        mock_guardian = MagicMock()
        mock_guardian.name = "failing_guardian"
        mock_guardian.always_run = False
        mock_guardian.guard.side_effect = RuntimeError("Test error")

        engine = ToolGuardEngine(guardians=[mock_guardian], enabled=True)
        result = engine.guard("test_tool", {"param": "value"})

        assert result is not None
        assert len(result.guardians_failed) == 1
        assert result.guardians_failed[0]["name"] == "failing_guardian"

    def test_guard_with_only_always_run(self):
        """Test guard with only_always_run flag."""
        always_guardian = MagicMock()
        always_guardian.name = "always"
        always_guardian.always_run = True
        always_guardian.guard.return_value = []

        normal_guardian = MagicMock()
        normal_guardian.name = "normal"
        normal_guardian.always_run = False
        normal_guardian.guard.return_value = []

        engine = ToolGuardEngine(
            guardians=[always_guardian, normal_guardian],
            enabled=True,
        )
        engine.guard("test_tool", {"param": "value"}, only_always_run=True)

        always_guardian.guard.assert_called_once()
        normal_guardian.guard.assert_not_called()

    def test_enabled_property(self):
        """Test enabled property getter and setter."""
        engine = ToolGuardEngine(enabled=True)
        assert engine.enabled is True

        engine.enabled = False
        assert engine.enabled is False

    def test_guarded_tools_property(self):
        """Test guarded_tools property."""
        engine = ToolGuardEngine(enabled=True)
        # Default behavior depends on config
        guarded = engine.guarded_tools
        assert guarded is None or isinstance(guarded, set)

    def test_denied_tools_property(self):
        """Test denied_tools property."""
        engine = ToolGuardEngine(enabled=True)
        denied = engine.denied_tools
        assert isinstance(denied, set)

    def test_is_denied(self):
        """Test is_denied method."""
        engine = ToolGuardEngine(enabled=True)
        # By default, no tools are denied
        assert engine.is_denied("some_tool") is False

    def test_is_guarded(self):
        """Test is_guarded method."""
        engine = ToolGuardEngine(enabled=True)
        # Check if tool falls within guard scope
        result = engine.is_guarded("execute_shell_command")
        # Result depends on configuration
        assert isinstance(result, bool)

    def test_reload_rules(self):
        """Test reload_rules method."""
        mock_guardian = MagicMock()
        mock_guardian.name = "reloadable"
        mock_guardian.always_run = False
        mock_guardian.reload = MagicMock()

        engine = ToolGuardEngine(guardians=[mock_guardian], enabled=True)
        engine.reload_rules()

        mock_guardian.reload.assert_called_once()


class TestGetGuardEngine:
    """Tests for get_guard_engine singleton."""

    def test_returns_engine_instance(self):
        """Test that get_guard_engine returns an engine instance."""
        from wisecore.security.tool_guard import engine as engine_module

        # Reset singleton
        engine_module._engine_instance = None

        engine = get_guard_engine()
        assert isinstance(engine, ToolGuardEngine)

        # Cleanup
        engine_module._engine_instance = None

    def test_singleton_behavior(self):
        """Test that get_guard_engine returns same instance."""
        from wisecore.security.tool_guard import engine as engine_module

        # Reset singleton
        engine_module._engine_instance = None

        engine1 = get_guard_engine()
        engine2 = get_guard_engine()

        assert engine1 is engine2

        # Cleanup
        engine_module._engine_instance = None
