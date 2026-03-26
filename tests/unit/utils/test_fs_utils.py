# -*- coding: utf-8 -*-
"""Unit tests for filesystem utilities."""

from __future__ import annotations

import json
import os
from pathlib import Path
from unittest.mock import patch

import pytest

from wisecore.utils.fs_utils import chmod_best_effort, prepare_secret_parent, safe_write_json


class TestChmodBestEffort:
    """Tests for chmod_best_effort."""

    def test_chmod_success(self, temp_dir: Path):
        """Test successful chmod operation."""
        test_file = temp_dir / "test.txt"
        test_file.write_text("test")

        # Should not raise
        chmod_best_effort(test_file, 0o644)

        # Verify permissions (on systems that support it)
        if os.name != "nt":
            stat_info = os.stat(test_file)
            assert stat_info.st_mode & 0o777 == 0o644

    def test_chmod_nonexistent_file_no_raise(self, temp_dir: Path):
        """Test that chmod on nonexistent file doesn't raise."""
        nonexistent = temp_dir / "nonexistent.txt"

        # Should not raise
        chmod_best_effort(nonexistent, 0o644)

    def test_chmod_invalid_path_no_raise(self):
        """Test that chmod with invalid path doesn't raise."""
        # Should not raise
        chmod_best_effort("/nonexistent/path/file.txt", 0o644)


class TestPrepareSecretParent:
    """Tests for prepare_secret_parent."""

    def test_creates_parent_directory(self, temp_dir: Path):
        """Test that parent directory is created."""
        test_file = temp_dir / "subdir" / "secret" / "file.txt"

        prepare_secret_parent(test_file)

        assert test_file.parent.exists()

    def test_existing_parent_no_error(self, temp_dir: Path):
        """Test that existing parent doesn't cause error."""
        test_file = temp_dir / "existing" / "file.txt"
        test_file.parent.mkdir(parents=True, exist_ok=True)

        # Should not raise
        prepare_secret_parent(test_file)

    def test_sets_secure_permissions(self, temp_dir: Path):
        """Test that parent directory has secure permissions."""
        test_file = temp_dir / "secure" / "file.txt"

        prepare_secret_parent(test_file)

        if os.name != "nt":
            stat_info = os.stat(test_file.parent)
            assert stat_info.st_mode & 0o777 == 0o700


class TestSafeWriteJson:
    """Tests for safe_write_json."""

    def test_write_json_creates_file(self, temp_dir: Path):
        """Test that JSON file is created."""
        test_file = temp_dir / "config.json"
        data = {"key": "value", "number": 42}

        safe_write_json(test_file, data)

        assert test_file.exists()
        loaded = json.loads(test_file.read_text())
        assert loaded == data

    def test_write_json_overwrites_existing(self, temp_dir: Path):
        """Test that existing file is overwritten."""
        test_file = temp_dir / "config.json"
        test_file.write_text('{"old": "data"}')

        new_data = {"new": "value"}
        safe_write_json(test_file, new_data)

        loaded = json.loads(test_file.read_text())
        assert loaded == new_data

    def test_write_json_with_unicode(self, temp_dir: Path):
        """Test that Unicode content is handled correctly."""
        test_file = temp_dir / "unicode.json"
        data = {"chinese": "中文测试", "emoji": "🎉"}

        safe_write_json(test_file, data)

        loaded = json.loads(test_file.read_text(encoding="utf-8"))
        assert loaded["chinese"] == "中文测试"
        assert loaded["emoji"] == "🎉"

    def test_write_json_atomic(self, temp_dir: Path):
        """Test that write handles errors gracefully."""
        test_file = temp_dir / "atomic.json"

        # The function uses os.fdopen, patch it to simulate an error
        with patch("os.fdopen", side_effect=PermissionError("Test error")):
            with pytest.raises(PermissionError):
                safe_write_json(test_file, {"key": "value"})

        # File should not exist after failed write
        assert not test_file.exists()

    def test_write_json_creates_parent(self, temp_dir: Path):
        """Test that parent directory is created when ensure_parent=True."""
        test_file = temp_dir / "new" / "dir" / "file.json"

        safe_write_json(test_file, {"test": 1}, ensure_parent=True)

        assert test_file.exists()
