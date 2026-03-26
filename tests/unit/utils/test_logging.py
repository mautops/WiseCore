# -*- coding: utf-8 -*-
"""Unit tests for logging utilities."""

from __future__ import annotations

import io
import logging
import sys
from unittest.mock import patch

import pytest

from wisecore.utils.logging import (
    ColorFormatter,
    SuppressPathAccessLogFilter,
    add_wisecore_file_handler,
    setup_logger,
)


class TestColorFormatter:
    """Tests for ColorFormatter."""

    def test_format_info_message(self):
        """Test formatting of INFO level messages."""
        formatter = ColorFormatter("%(message)s", "%Y-%m-%d")
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="/test/path.py",
            lineno=10,
            msg="Test message",
            args=(),
            exc_info=None,
        )

        with patch.object(sys.stderr, "isatty", return_value=True):
            result = formatter.format(record)

        assert "INFO" in result
        assert "Test message" in result

    def test_format_error_message(self):
        """Test formatting of ERROR level messages."""
        formatter = ColorFormatter("%(message)s", "%Y-%m-%d")
        record = logging.LogRecord(
            name="test",
            level=logging.ERROR,
            pathname="/test/path.py",
            lineno=20,
            msg="Error occurred",
            args=(),
            exc_info=None,
        )

        with patch.object(sys.stderr, "isatty", return_value=True):
            result = formatter.format(record)

        assert "ERROR" in result
        assert "Error occurred" in result

    def test_format_without_color_when_not_tty(self):
        """Test that colors are not used when output is not a TTY."""
        formatter = ColorFormatter("%(message)s", "%Y-%m-%d")
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="/test/path.py",
            lineno=10,
            msg="Test",
            args=(),
            exc_info=None,
        )

        with patch.object(sys.stderr, "isatty", return_value=False):
            result = formatter.format(record)

        # Should not contain ANSI color codes
        assert "\033[32m" not in result


class TestSuppressPathAccessLogFilter:
    """Tests for SuppressPathAccessLogFilter."""

    def test_filter_allows_when_no_paths(self):
        """Test that filter allows all records when no paths specified."""
        filter_obj = SuppressPathAccessLogFilter([])
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="GET /api/test",
            args=(),
            exc_info=None,
        )

        assert filter_obj.filter(record) is True

    def test_filter_blocks_matching_paths(self):
        """Test that filter blocks records with matching paths."""
        filter_obj = SuppressPathAccessLogFilter(["/health", "/metrics"])
        record = logging.LogRecord(
            name="uvicorn.access",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="GET /health 200",
            args=(),
            exc_info=None,
        )

        assert filter_obj.filter(record) is False

    def test_filter_allows_non_matching_paths(self):
        """Test that filter allows records without matching paths."""
        filter_obj = SuppressPathAccessLogFilter(["/health", "/metrics"])
        record = logging.LogRecord(
            name="uvicorn.access",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="GET /api/users 200",
            args=(),
            exc_info=None,
        )

        assert filter_obj.filter(record) is True


class TestSetupLogger:
    """Tests for setup_logger."""

    def test_setup_logger_default_level(self):
        """Test setup_logger with default level."""
        logger = setup_logger()
        assert logger is not None
        assert logger.level == logging.INFO

    def test_setup_logger_with_string_level(self):
        """Test setup_logger with string level."""
        logger = setup_logger("debug")
        assert logger.level == logging.DEBUG

    def test_setup_logger_with_int_level(self):
        """Test setup_logger with integer level."""
        logger = setup_logger(logging.WARNING)
        assert logger.level == logging.WARNING

    def test_setup_logger_idempotent(self):
        """Test that calling setup_logger multiple times doesn't add duplicate handlers."""
        logger1 = setup_logger("info")
        handler_count = len(logger1.handlers)
        logger2 = setup_logger("info")
        assert len(logger2.handlers) == handler_count
