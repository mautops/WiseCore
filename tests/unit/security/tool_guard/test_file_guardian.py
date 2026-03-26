# -*- coding: utf-8 -*-
"""Unit tests for FilePathToolGuardian."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

from wisecore.security.tool_guard.guardians.file_guardian import (
    FilePathToolGuardian,
    _normalize_path,
    _looks_like_path_token,
    _extract_paths_from_shell_command,
    _TOOL_FILE_PARAMS,
    _SHELL_REDIRECT_OPERATORS,
)
from wisecore.security.tool_guard.models import GuardSeverity, GuardThreatCategory


class TestToolFileParams:
    """Tests for tool file parameters mapping."""

    def test_known_file_tools_exist(self):
        """Test that known file tools are defined."""
        expected_tools = [
            "read_file",
            "write_file",
            "edit_file",
            "append_file",
            "send_file_to_user",
        ]

        for tool in expected_tools:
            assert tool in _TOOL_FILE_PARAMS

    def test_file_params_are_tuples(self):
        """Test that file params are tuples."""
        for tool, params in _TOOL_FILE_PARAMS.items():
            assert isinstance(params, tuple)


class TestShellRedirectOperators:
    """Tests for shell redirect operators."""

    def test_redirect_operators_exist(self):
        """Test that expected redirect operators are defined."""
        expected = {">", ">>", "1>", "1>>", "2>", "2>>", "&>", "&>>", "<", "<<", "<<<"}

        assert expected.issubset(_SHELL_REDIRECT_OPERATORS)


class TestNormalizePath:
    """Tests for _normalize_path function."""

    def test_normalizes_absolute_path(self):
        """Test normalizing absolute path."""
        with patch(
            "wisecore.security.tool_guard.guardians.file_guardian._workspace_root",
            return_value=Path("/workspace"),
        ):
            result = _normalize_path("/tmp/test.txt")

            assert result.startswith("/")

    def test_normalizes_relative_path(self):
        """Test normalizing relative path."""
        with patch(
            "wisecore.security.tool_guard.guardians.file_guardian._workspace_root",
            return_value=Path("/workspace"),
        ):
            result = _normalize_path("relative/path.txt")

            # Should be resolved to absolute
            assert Path(result).is_absolute()

    def test_expands_tilde(self):
        """Test that tilde is expanded."""
        with patch(
            "wisecore.security.tool_guard.guardians.file_guardian._workspace_root",
            return_value=Path("/workspace"),
        ):
            result = _normalize_path("~/test.txt")

            # Should expand ~ to home directory
            assert "~" not in result


class TestLooksLikePathToken:
    """Tests for _looks_like_path_token function."""

    def test_returns_false_for_empty_string(self):
        """Test that empty string returns False."""
        assert _looks_like_path_token("") is False

    def test_returns_false_for_flag(self):
        """Test that flags return False."""
        assert _looks_like_path_token("--help") is False
        assert _looks_like_path_token("-la") is False

    def test_returns_false_for_url(self):
        """Test that URLs return False."""
        assert _looks_like_path_token("http://example.com") is False
        assert _looks_like_path_token("https://example.com") is False

    def test_returns_false_for_mime_type(self):
        """Test that MIME types return False."""
        assert _looks_like_path_token("text/plain") is False
        assert _looks_like_path_token("image/png") is False

    def test_returns_true_for_path_with_slash(self):
        """Test that paths with slash return True."""
        assert _looks_like_path_token("/tmp/test.txt") is True
        assert _looks_like_path_token("relative/path") is True

    def test_returns_true_for_tilde_path(self):
        """Test that tilde paths return True."""
        assert _looks_like_path_token("~/test.txt") is True

    def test_returns_true_for_dot_slash_path(self):
        """Test that ./ paths return True."""
        assert _looks_like_path_token("./test.txt") is True

    def test_returns_true_for_double_dot_slash(self):
        """Test that ../ paths return True."""
        assert _looks_like_path_token("../test.txt") is True


class TestExtractPathsFromShellCommand:
    """Tests for _extract_paths_from_shell_command function."""

    def test_extracts_simple_path(self):
        """Test extracting simple path from command."""
        result = _extract_paths_from_shell_command("cat /tmp/test.txt")

        assert "/tmp/test.txt" in result

    def test_extracts_multiple_paths(self):
        """Test extracting multiple paths from command."""
        result = _extract_paths_from_shell_command("cp /source/file.txt /dest/")

        assert "/source/file.txt" in result
        assert "/dest/" in result

    def test_extracts_redirect_output(self):
        """Test extracting redirect output path."""
        result = _extract_paths_from_shell_command("echo hello > /tmp/output.txt")

        assert "/tmp/output.txt" in result

    def test_extracts_redirect_input(self):
        """Test extracting redirect input path."""
        result = _extract_paths_from_shell_command("cat < /tmp/input.txt")

        assert "/tmp/input.txt" in result

    def test_extracts_append_redirect(self):
        """Test extracting append redirect path."""
        result = _extract_paths_from_shell_command("echo test >> /tmp/log.txt")

        assert "/tmp/log.txt" in result

    def test_handles_quoted_paths(self):
        """Test handling quoted paths."""
        result = _extract_paths_from_shell_command('cat "/tmp/my file.txt"')

        assert "/tmp/my file.txt" in result

    def test_excludes_urls(self):
        """Test that URLs are excluded."""
        result = _extract_paths_from_shell_command("curl http://example.com > /tmp/out.txt")

        assert "http://example.com" not in result
        assert "/tmp/out.txt" in result

    def test_handles_empty_command(self):
        """Test handling empty command."""
        result = _extract_paths_from_shell_command("")

        assert result == []

    def test_deduplicates_paths(self):
        """Test that duplicate paths are removed."""
        result = _extract_paths_from_shell_command("cat /tmp/test.txt /tmp/test.txt")

        assert result.count("/tmp/test.txt") == 1


class TestFilePathToolGuardian:
    """Tests for FilePathToolGuardian class."""

    def test_initialization_with_defaults(self):
        """Test initialization with default settings."""
        guardian = FilePathToolGuardian()

        assert guardian.name == "file_path_tool_guardian"
        assert guardian.always_run is True

    def test_initialization_with_custom_sensitive_files(self):
        """Test initialization with custom sensitive files."""
        guardian = FilePathToolGuardian(
            sensitive_files=["/etc/passwd", "/etc/shadow"],
        )

        sensitive = guardian.sensitive_files
        assert any("passwd" in p for p in sensitive)

    def test_add_sensitive_file(self):
        """Test adding a sensitive file."""
        guardian = FilePathToolGuardian()

        guardian.add_sensitive_file("/custom/sensitive.txt")

        sensitive = guardian.sensitive_files
        assert any("sensitive.txt" in p for p in sensitive)

    def test_remove_sensitive_file(self):
        """Test removing a sensitive file."""
        guardian = FilePathToolGuardian(
            sensitive_files=["/tmp/test.txt"],
        )

        result = guardian.remove_sensitive_file("/tmp/test.txt")

        assert result is True
        assert "/tmp/test.txt" not in guardian.sensitive_files

    def test_remove_nonexistent_file(self):
        """Test removing a file that doesn't exist in sensitive list."""
        guardian = FilePathToolGuardian()

        result = guardian.remove_sensitive_file("/nonexistent/file.txt")

        assert result is False

    def test_guard_returns_empty_when_disabled(self):
        """Test guard returns empty list when disabled."""
        guardian = FilePathToolGuardian()
        guardian._enabled = False

        result = guardian.guard("read_file", {"file_path": "/etc/passwd"})

        assert result == []

    def test_guard_returns_empty_for_safe_file(self, temp_dir: Path):
        """Test guard returns empty for safe file."""
        safe_file = temp_dir / "safe.txt"
        safe_file.touch()

        guardian = FilePathToolGuardian(
            sensitive_files=["/etc/passwd"],
        )

        result = guardian.guard("read_file", {"file_path": str(safe_file)})

        assert result == []

    def test_guard_detects_sensitive_file_access(self):
        """Test guard detects access to sensitive file."""
        guardian = FilePathToolGuardian(
            sensitive_files=["/etc/passwd"],
        )

        result = guardian.guard("read_file", {"file_path": "/etc/passwd"})

        assert len(result) == 1
        assert result[0].severity == GuardSeverity.HIGH
        assert result[0].category == GuardThreatCategory.SENSITIVE_FILE_ACCESS

    def test_guard_detects_sensitive_dir_access(self, temp_dir: Path):
        """Test guard detects access to file in sensitive directory."""
        sensitive_dir = temp_dir / "secrets"
        sensitive_dir.mkdir()

        guardian = FilePathToolGuardian(
            sensitive_files=[str(sensitive_dir) + "/"],
        )

        result = guardian.guard(
            "read_file",
            {"file_path": str(sensitive_dir / "secret.txt")},
        )

        assert len(result) == 1
        assert result[0].category == GuardThreatCategory.SENSITIVE_FILE_ACCESS

    def test_guard_handles_shell_command(self):
        """Test guard handles shell command with sensitive path."""
        guardian = FilePathToolGuardian(
            sensitive_files=["/etc/shadow"],
        )

        result = guardian.guard(
            "execute_shell_command",
            {"command": "cat /etc/shadow"},
        )

        assert len(result) >= 1
        assert any(
            f.severity == GuardSeverity.HIGH
            for f in result
        )

    def test_guard_handles_shell_redirect(self):
        """Test guard handles shell redirect to sensitive path."""
        guardian = FilePathToolGuardian(
            sensitive_files=["/etc/critical"],
        )

        result = guardian.guard(
            "execute_shell_command",
            {"command": "echo test > /etc/critical"},
        )

        assert len(result) >= 1

    def test_guard_ignores_non_file_tools_without_path_params(self):
        """Test guard ignores tools without path-like parameters."""
        guardian = FilePathToolGuardian(
            sensitive_files=["/etc/passwd"],
        )

        result = guardian.guard(
            "some_tool",
            {"data": "some string data"},
        )

        # Should not detect - the data param doesn't look like a path
        assert result == []

    def test_set_sensitive_files_replaces_list(self):
        """Test set_sensitive_files replaces existing list."""
        guardian = FilePathToolGuardian(
            sensitive_files=["/old/file.txt"],
        )

        guardian.set_sensitive_files(["/new/file.txt"])

        sensitive = guardian.sensitive_files
        assert not any("old" in p for p in sensitive)
        assert any("new" in p for p in sensitive)

    def test_reload_refreshes_config(self):
        """Test reload refreshes configuration."""
        guardian = FilePathToolGuardian()

        # Should not raise
        guardian.reload()

    def test_finding_has_correct_metadata(self):
        """Test that finding has correct metadata."""
        guardian = FilePathToolGuardian(
            sensitive_files=["/etc/passwd"],
        )

        result = guardian.guard("read_file", {"file_path": "/etc/passwd"})

        assert len(result) == 1
        finding = result[0]
        assert finding.tool_name == "read_file"
        assert finding.param_name == "file_path"
        assert finding.guardian == "file_path_tool_guardian"
        assert "resolved_path" in finding.metadata
