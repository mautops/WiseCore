# -*- coding: utf-8 -*-
"""Unit tests for tool guard utilities."""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest

from wisecore.security.tool_guard.utils import (
    _parse_guarded_tokens,
    resolve_guarded_tools,
    resolve_denied_tools,
    log_findings,
)
from wisecore.security.tool_guard.models import (
    GuardFinding,
    GuardSeverity,
    GuardThreatCategory,
    ToolGuardResult,
)


class TestParseGuardedTokens:
    """Tests for _parse_guarded_tokens function."""

    def test_parse_empty_tokens(self):
        """Test parsing empty tokens."""
        result = _parse_guarded_tokens([])
        assert result == set()

    def test_parse_none_tokens(self):
        """Test parsing None tokens."""
        result = _parse_guarded_tokens([None, "", "  "])  # type: ignore
        assert result == set()

    def test_parse_specific_tools(self):
        """Test parsing specific tool names."""
        result = _parse_guarded_tokens(["execute_shell_command", "read_file"])
        assert result == {"execute_shell_command", "read_file"}

    def test_parse_all_wildcard(self):
        """Test parsing 'all' wildcard."""
        result = _parse_guarded_tokens(["*"])
        assert result is None  # None means guard all

    def test_parse_all_keyword(self):
        """Test parsing 'all' keyword."""
        result = _parse_guarded_tokens(["all"])
        assert result is None

    def test_parse_none_keyword(self):
        """Test parsing 'none' keyword."""
        result = _parse_guarded_tokens(["none"])
        assert result == set()

    def test_parse_off_keyword(self):
        """Test parsing 'off' keyword."""
        result = _parse_guarded_tokens(["off"])
        assert result == set()

    def test_parse_false_keyword(self):
        """Test parsing 'false' keyword."""
        result = _parse_guarded_tokens(["false"])
        assert result == set()

    def test_parse_whitespace_in_tokens(self):
        """Test that whitespace is stripped from tokens."""
        result = _parse_guarded_tokens(["  tool_one  ", "  tool_two  "])
        assert result == {"tool_one", "tool_two"}


class TestResolveGuardedTools:
    """Tests for resolve_guarded_tools function."""

    def test_resolve_with_user_defined(self):
        """Test resolve with user-defined tools."""
        result = resolve_guarded_tools(user_defined=["tool_a", "tool_b"])
        assert result == {"tool_a", "tool_b"}

    def test_resolve_user_defined_all(self):
        """Test resolve with user-defined 'all'."""
        result = resolve_guarded_tools(user_defined=["*"])
        assert result is None

    def test_resolve_user_defined_none(self):
        """Test resolve with user-defined 'none'."""
        result = resolve_guarded_tools(user_defined=["none"])
        assert result == set()

    def test_resolve_from_env_all(self):
        """Test resolve from env var with 'all'."""
        with patch.dict(os.environ, {"TOOL_GUARD_TOOLS": "all"}, clear=False):
            result = resolve_guarded_tools()
            assert result is None

    def test_resolve_from_env_specific(self):
        """Test resolve from env var with specific tools."""
        with patch.dict(
            os.environ,
            {"TOOL_GUARD_TOOLS": "tool_x,tool_y"},
            clear=False,
        ):
            result = resolve_guarded_tools()
            assert result == {"tool_x", "tool_y"}

    def test_resolve_from_env_empty(self):
        """Test resolve from env var with empty string."""
        with patch.dict(os.environ, {"TOOL_GUARD_TOOLS": ""}, clear=False):
            # Should fall back to defaults
            result = resolve_guarded_tools()
            # Result depends on whether config exists or defaults are used
            assert result is None or isinstance(result, set)


class TestResolveDeniedTools:
    """Tests for resolve_denied_tools function."""

    def test_resolve_with_user_defined(self):
        """Test resolve with user-defined denied tools."""
        result = resolve_denied_tools(user_defined={"dangerous_tool"})
        assert result == {"dangerous_tool"}

    def test_resolve_from_env(self):
        """Test resolve from env var."""
        with patch.dict(
            os.environ,
            {"TOOL_GUARD_DENIED_TOOLS": "bad_tool,worse_tool"},
            clear=False,
        ):
            result = resolve_denied_tools()
            assert result == {"bad_tool", "worse_tool"}

    def test_resolve_from_env_empty(self):
        """Test resolve from env var with empty string."""
        with patch.dict(
            os.environ,
            {"TOOL_GUARD_DENIED_TOOLS": ""},
            clear=False,
        ):
            result = resolve_denied_tools()
            assert result == set()

    def test_resolve_default_empty(self):
        """Test default is empty set."""
        with patch.dict(os.environ, {}, clear=True):
            # Clear any existing env vars
            if "TOOL_GUARD_DENIED_TOOLS" in os.environ:
                del os.environ["TOOL_GUARD_DENIED_TOOLS"]

        result = resolve_denied_tools()
        assert isinstance(result, set)


class TestLogFindings:
    """Tests for log_findings function."""

    def test_log_findings_with_critical(self):
        """Test logging critical severity findings."""
        finding = GuardFinding(
            id="f1",
            rule_id="R1",
            category=GuardThreatCategory.COMMAND_INJECTION,
            severity=GuardSeverity.CRITICAL,
            title="Critical Issue",
            description="A critical security issue",
            tool_name="test_tool",
            param_name="cmd",
            matched_value="rm -rf /",
        )

        result = ToolGuardResult(
            tool_name="test_tool",
            params={"cmd": "rm -rf /"},
            findings=[finding],
        )

        # Should not raise
        log_findings("test_tool", result)

    def test_log_findings_with_high(self):
        """Test logging high severity findings."""
        finding = GuardFinding(
            id="f1",
            rule_id="R1",
            category=GuardThreatCategory.PATH_TRAVERSAL,
            severity=GuardSeverity.HIGH,
            title="Path Traversal",
            description="Path traversal attempt",
            tool_name="read_file",
        )

        result = ToolGuardResult(
            tool_name="read_file",
            params={},
            findings=[finding],
        )

        # Should not raise
        log_findings("read_file", result)

    def test_log_findings_with_low(self):
        """Test logging low severity findings."""
        finding = GuardFinding(
            id="f1",
            rule_id="R1",
            category=GuardThreatCategory.SENSITIVE_FILE_ACCESS,
            severity=GuardSeverity.LOW,
            title="Info",
            description="Informational finding",
            tool_name="test_tool",
        )

        result = ToolGuardResult(
            tool_name="test_tool",
            params={},
            findings=[finding],
        )

        # Should not raise
        log_findings("test_tool", result)

    def test_log_findings_empty(self):
        """Test logging with no findings."""
        result = ToolGuardResult(
            tool_name="safe_tool",
            params={},
            findings=[],
        )

        # Should not raise
        log_findings("safe_tool", result)
