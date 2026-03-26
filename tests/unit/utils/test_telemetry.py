# -*- coding: utf-8 -*-
"""Unit tests for telemetry module."""

from __future__ import annotations

import json
import os
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from wisecore.utils.telemetry import (
    collect_and_upload_telemetry,
    get_system_info,
    has_telemetry_been_collected,
    is_telemetry_opted_out,
    mark_telemetry_collected,
)


class TestGetSystemInfo:
    """Tests for get_system_info."""

    def test_returns_dict(self):
        """Test that system info returns a dictionary."""
        info = get_system_info()

        assert isinstance(info, dict)

    def test_contains_required_fields(self):
        """Test that system info contains required fields."""
        info = get_system_info()

        required_fields = [
            "install_id",
            "wisecore_version",
            "install_method",
            "os",
            "os_version",
            "python_version",
            "architecture",
            "has_gpu",
        ]

        for field in required_fields:
            assert field in info

    def test_install_id_is_uuid(self):
        """Test that install_id is a valid UUID format."""
        info = get_system_info()

        install_id = info["install_id"]
        parts = install_id.split("-")
        assert len(parts) == 5
        assert len(parts[0]) == 8

    def test_python_version_format(self):
        """Test that python_version is in major.minor format."""
        info = get_system_info()

        version = info["python_version"]
        parts = version.split(".")
        assert len(parts) == 2
        assert parts[0].isdigit()
        assert parts[1].isdigit()


class TestHasTelemetryBeenCollected:
    """Tests for has_telemetry_been_collected."""

    def test_returns_false_when_no_marker(self, temp_dir: Path):
        """Test returns False when marker file doesn't exist."""
        assert has_telemetry_been_collected(temp_dir) is False

    def test_returns_true_when_version_collected(self, temp_dir: Path):
        """Test returns True when current version has been collected."""
        marker_file = temp_dir / ".telemetry_collected"
        marker_data = {
            "collected_versions": ["0.1.0"],
            "wisecore_version": "0.1.0",
        }
        marker_file.write_text(json.dumps(marker_data))

        with patch(
            "wisecore.utils.telemetry._get_current_version",
            return_value="0.1.0",
        ):
            assert has_telemetry_been_collected(temp_dir) is True

    def test_returns_false_for_different_version(self, temp_dir: Path):
        """Test returns False when different version was collected."""
        marker_file = temp_dir / ".telemetry_collected"
        marker_data = {
            "collected_versions": ["0.1.0"],
            "wisecore_version": "0.1.0",
        }
        marker_file.write_text(json.dumps(marker_data))

        with patch(
            "wisecore.utils.telemetry._get_current_version",
            return_value="0.2.0",
        ):
            assert has_telemetry_been_collected(temp_dir) is False


class TestIsTelemetryOptedOut:
    """Tests for is_telemetry_opted_out."""

    def test_returns_false_when_no_marker(self, temp_dir: Path):
        """Test returns False when marker file doesn't exist."""
        assert is_telemetry_opted_out(temp_dir) is False

    def test_returns_true_when_opted_out(self, temp_dir: Path):
        """Test returns True when opted_out is True."""
        marker_file = temp_dir / ".telemetry_collected"
        marker_data = {"opted_out": True}
        marker_file.write_text(json.dumps(marker_data))

        assert is_telemetry_opted_out(temp_dir) is True

    def test_returns_false_when_not_opted_out(self, temp_dir: Path):
        """Test returns False when opted_out is False."""
        marker_file = temp_dir / ".telemetry_collected"
        marker_data = {"opted_out": False}
        marker_file.write_text(json.dumps(marker_data))

        assert is_telemetry_opted_out(temp_dir) is False


class TestMarkTelemetryCollected:
    """Tests for mark_telemetry_collected."""

    def test_creates_marker_file(self, temp_dir: Path):
        """Test that marker file is created."""
        mark_telemetry_collected(temp_dir)

        marker_file = temp_dir / ".telemetry_collected"
        assert marker_file.exists()

    def test_records_version(self, temp_dir: Path):
        """Test that version is recorded in marker file."""
        with patch(
            "wisecore.utils.telemetry._get_current_version",
            return_value="1.0.0",
        ):
            mark_telemetry_collected(temp_dir)

        marker_file = temp_dir / ".telemetry_collected"
        data = json.loads(marker_file.read_text())

        assert "1.0.0" in data.get("collected_versions", [])

    def test_opted_out_persists(self, temp_dir: Path):
        """Test that opted_out status persists."""
        # First mark as opted out
        mark_telemetry_collected(temp_dir, opted_out=True)

        # Later mark again without opted_out
        mark_telemetry_collected(temp_dir)

        assert is_telemetry_opted_out(temp_dir) is True


class TestCollectAndUploadTelemetry:
    """Tests for collect_and_upload_telemetry."""

    def test_marks_collected_even_on_upload_failure(self, temp_dir: Path):
        """Test that telemetry is marked collected even if upload fails."""
        with patch(
            "wisecore.utils.telemetry._upload_telemetry_sync",
            return_value=False,
        ):
            result = collect_and_upload_telemetry(temp_dir)

        assert result is False
        assert has_telemetry_been_collected(temp_dir) or is_telemetry_opted_out(
            temp_dir,
        )
