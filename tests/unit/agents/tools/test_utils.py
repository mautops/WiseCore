# -*- coding: utf-8 -*-
"""Unit tests for agents tools utilities."""

from __future__ import annotations

import pytest

from wisecore.agents.tools.utils import (
    truncate_output,
    truncate_file_output,
    truncate_shell_output,
    read_file_safe,
    DEFAULT_MAX_LINES,
    DEFAULT_MAX_BYTES,
)


class TestTruncateOutput:
    """Tests for truncate_output function."""

    def test_empty_text_returns_unchanged(self):
        """Test that empty text returns unchanged."""
        result, truncated, line_count, reason = truncate_output("")

        assert result == ""
        assert truncated is False
        assert line_count == 0
        assert reason == ""

    def test_short_text_returns_unchanged(self):
        """Test that short text returns unchanged."""
        text = "Hello, world!\nLine 2\nLine 3"
        result, truncated, line_count, reason = truncate_output(text)

        assert result == text
        assert truncated is False
        assert line_count == 3
        assert reason == ""

    def test_truncates_by_lines_head(self):
        """Test truncation by lines keeping head."""
        lines = [f"Line {i}" for i in range(2000)]
        text = "\n".join(lines)

        result, truncated, line_count, reason = truncate_output(
            text,
            max_lines=100,
            keep="head",
        )

        assert truncated is True
        assert line_count == 100
        assert reason == "lines"
        assert result.startswith("Line 0")

    def test_truncates_by_lines_tail(self):
        """Test truncation by lines keeping tail."""
        lines = [f"Line {i}" for i in range(2000)]
        text = "\n".join(lines)

        result, truncated, line_count, reason = truncate_output(
            text,
            max_lines=100,
            keep="tail",
        )

        assert truncated is True
        assert line_count == 100
        assert reason == "lines"
        assert "Line 1900" in result

    def test_truncates_by_bytes_head(self):
        """Test truncation by bytes keeping head."""
        text = "a" * 50000

        result, truncated, line_count, reason = truncate_output(
            text,
            max_lines=10000,
            max_bytes=1000,
            keep="head",
        )

        assert truncated is True
        assert reason == "bytes"
        assert len(result.encode("utf-8")) <= 1000

    def test_truncates_by_bytes_tail(self):
        """Test truncation by bytes keeping tail."""
        text = "a" * 50000

        result, truncated, line_count, reason = truncate_output(
            text,
            max_lines=10000,
            max_bytes=1000,
            keep="tail",
        )

        assert truncated is True
        assert reason == "bytes"
        assert len(result.encode("utf-8")) <= 1000

    def test_handles_unicode_multibyte(self):
        """Test handling of multi-byte UTF-8 characters."""
        text = "你好世界" * 10000  # Chinese characters

        result, truncated, line_count, reason = truncate_output(
            text,
            max_bytes=1000,
            keep="head",
        )

        assert truncated is True
        # Should not raise UnicodeDecodeError
        result.encode("utf-8")


class TestTruncateFileOutput:
    """Tests for truncate_file_output function."""

    def test_empty_text_returns_unchanged(self):
        """Test that empty text returns unchanged."""
        result = truncate_file_output("")

        assert result == ""

    def test_short_text_returns_unchanged(self):
        """Test that short text returns unchanged."""
        text = "Short content"
        result = truncate_file_output(text)

        assert result == text

    def test_truncated_output_includes_notice(self):
        """Test that truncated output includes notice."""
        lines = [f"Line {i}" for i in range(2000)]
        text = "\n".join(lines)

        result = truncate_file_output(text, start_line=1, total_lines=2000)

        assert "[Output truncated" in result
        assert "start_line=" in result

    def test_truncated_output_with_custom_start(self):
        """Test truncated output with custom start line."""
        lines = [f"Line {i}" for i in range(2000)]
        text = "\n".join(lines)

        result = truncate_file_output(text, start_line=100, total_lines=2000)

        assert "[Output truncated" in result


class TestTruncateShellOutput:
    """Tests for truncate_shell_output function."""

    def test_empty_text_returns_unchanged(self):
        """Test that empty text returns unchanged."""
        result = truncate_shell_output("")

        assert result == ""

    def test_short_text_returns_unchanged(self):
        """Test that short text returns unchanged."""
        text = "Command output"
        result = truncate_shell_output(text)

        assert result == text

    def test_truncated_output_keeps_tail(self):
        """Test that truncated output keeps tail."""
        lines = [f"Line {i}" for i in range(2000)]
        text = "\n".join(lines)

        result = truncate_shell_output(text)

        # Should keep last lines
        assert "Line 1999" in result
        assert "[Output truncated" in result

    def test_truncated_output_includes_notice(self):
        """Test that truncated output includes notice."""
        lines = [f"Line {i}" for i in range(2000)]
        text = "\n".join(lines)

        result = truncate_shell_output(text)

        assert "[Output truncated" in result


class TestReadFileSafe:
    """Tests for read_file_safe function."""

    def test_reads_utf8_file(self, temp_dir):
        """Test reading UTF-8 file."""
        from pathlib import Path

        file_path = temp_dir / "test.txt"
        file_path.write_text("Hello, 世界!", encoding="utf-8")

        result = read_file_safe(str(file_path))

        assert result == "Hello, 世界!"

    def test_handles_nonexistent_file(self):
        """Test handling nonexistent file."""
        with pytest.raises(FileNotFoundError):
            read_file_safe("/nonexistent/file.txt")

    def test_handles_binary_file_gracefully(self, temp_dir):
        """Test handling binary file with Unicode errors."""
        from pathlib import Path

        file_path = temp_dir / "binary.bin"
        # Write some bytes that are not valid UTF-8
        file_path.write_bytes(b"\x00\x01\x02\xff\xfe Hello")

        # Should not raise, just ignore invalid bytes
        result = read_file_safe(str(file_path))

        assert isinstance(result, str)


class TestDefaultConstants:
    """Tests for default constants."""

    def test_default_max_lines(self):
        """Test default max lines constant."""
        assert DEFAULT_MAX_LINES == 1000

    def test_default_max_bytes(self):
        """Test default max bytes constant."""
        assert DEFAULT_MAX_BYTES == 30 * 1024  # 30KB
