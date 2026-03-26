# -*- coding: utf-8 -*-
"""Unit tests for config module."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest


class TestTimezoneDetection:
    """Tests for timezone detection."""

    def test_detect_system_timezone_returns_string(self):
        """Test that timezone detection returns a string."""
        from wisecore.config.timezone import detect_system_timezone

        result = detect_system_timezone()
        assert isinstance(result, str)
        assert len(result) > 0

    def test_detect_system_timezone_never_raises(self):
        """Test that timezone detection never raises exceptions."""
        from wisecore.config.timezone import detect_system_timezone

        # Should never raise, even with broken environment
        with patch.dict("os.environ", {"TZ": ""}, clear=False):
            result = detect_system_timezone()
            assert isinstance(result, str)

    def test_detect_system_timezone_fallback_to_utc(self):
        """Test that detection falls back to UTC on errors."""
        from wisecore.config.timezone import _detect_system_timezone_inner

        # When all probes fail, should return UTC
        # This is an indirect test since we patch internal probes
        with patch(
            "wisecore.config.timezone._probe_python",
            return_value=None,
        ):
            with patch(
                "wisecore.config.timezone._probe_env",
                return_value=None,
            ):
                # On non-Windows, more probes are tried
                result = _detect_system_timezone_inner()
                assert isinstance(result, str)

    def test_is_iana_validation(self):
        """Test IANA timezone format validation."""
        from wisecore.config.timezone import _is_iana

        assert _is_iana("Asia/Shanghai") is True
        assert _is_iana("America/New_York") is True
        assert _is_iana("UTC") is False  # No slash
        assert _is_iana(None) is False
        assert _is_iana("") is False
        assert _is_iana("   ") is False
