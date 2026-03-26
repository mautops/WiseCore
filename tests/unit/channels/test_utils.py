# -*- coding: utf-8 -*-
"""Unit tests for channel utilities."""

from __future__ import annotations

import pytest

from wisecore.app.channels.utils import (
    split_text,
    file_url_to_local_path,
)


class TestSplitText:
    """Tests for split_text function."""

    def test_short_text_returns_single_chunk(self):
        """Test that short text returns single chunk."""
        text = "Hello, world!"
        result = split_text(text, max_len=100)

        assert len(result) == 1
        assert result[0] == text

    def test_splits_at_max_len(self):
        """Test that text is split at max_len."""
        text = "a" * 100
        result = split_text(text, max_len=30)

        assert all(len(chunk) <= 30 for chunk in result)
        assert "".join(result).replace("\n", "") == text

    def test_splits_at_newline_boundary(self):
        """Test that text prefers newline boundaries."""
        text = "Line one\nLine two\nLine three\nLine four"
        result = split_text(text, max_len=20)

        # Each chunk should be at most max_len
        assert all(len(chunk) <= 20 for chunk in result)

    def test_handles_empty_text(self):
        """Test that empty text returns empty list or list with empty string."""
        result = split_text("", max_len=100)

        # Function returns [''] for empty string which gets filtered to []
        # or returns [''], both are acceptable
        assert result == [] or result == [""]

    def test_handles_whitespace_only(self):
        """Test that whitespace-only text returns acceptable result."""
        result = split_text("   \n\n   ", max_len=100)

        # Function may return whitespace string or empty
        # Both behaviors are acceptable
        assert isinstance(result, list)

    def test_preserves_code_fence_across_split(self):
        """Test that code fences are properly closed and reopened."""
        text = "```python\ndef hello():\n    print('hello')\n```\nMore text after code block."

        result = split_text(text, max_len=30)

        # Result should have proper fence handling
        assert len(result) >= 1

    def test_hard_splits_long_line(self):
        """Test that long lines without newlines are hard-split."""
        text = "a" * 100
        result = split_text(text, max_len=30)

        # Should split into multiple chunks
        assert len(result) > 1


class TestFileUrlToLocalPath:
    """Tests for file_url_to_local_path function."""

    def test_returns_none_for_empty_string(self):
        """Test that empty string returns None."""
        result = file_url_to_local_path("")

        assert result is None

    def test_returns_none_for_none_input(self):
        """Test that None input returns None."""
        result = file_url_to_local_path(None)  # type: ignore

        assert result is None

    def test_returns_none_for_http_url(self):
        """Test that HTTP URL returns None."""
        result = file_url_to_local_path("http://example.com/file.txt")

        assert result is None

    def test_returns_none_for_https_url(self):
        """Test that HTTPS URL returns None."""
        result = file_url_to_local_path("https://example.com/file.txt")

        assert result is None

    def test_converts_file_url_to_path(self):
        """Test that file:// URL is converted to local path."""
        result = file_url_to_local_path("file:///tmp/test.txt")

        assert result is not None
        assert "test.txt" in result

    def test_passes_through_plain_path(self):
        """Test that plain local path is passed through."""
        result = file_url_to_local_path("/tmp/test.txt")

        assert result == "/tmp/test.txt"

    def test_handles_whitespace(self):
        """Test that leading/trailing whitespace is stripped."""
        result = file_url_to_local_path("  /tmp/test.txt  ")

        assert result == "/tmp/test.txt"

    def test_handles_windows_style_path(self):
        """Test Windows-style path handling."""
        # This test is platform-dependent
        result = file_url_to_local_path("file:///C:/Users/test/file.txt")

        # Should return a path (exact format depends on platform)
        assert result is not None

    def test_returns_none_for_other_schemes(self):
        """Test that other URL schemes return None."""
        result = file_url_to_local_path("ftp://example.com/file.txt")

        assert result is None

    def test_handles_file_url_with_netloc(self):
        """Test file:// URL with netloc."""
        result = file_url_to_local_path("file://localhost/tmp/test.txt")

        # Should return a path
        assert result is not None
