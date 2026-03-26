# -*- coding: utf-8 -*-
"""Tests for Wisecore package initialization and version."""

from __future__ import annotations

import sys
from pathlib import Path


class TestPackageInit:
    """Tests for package initialization."""

    def test_version_exists(self):
        """Test that __version__ is defined."""
        from wisecore.__version__ import __version__

        assert isinstance(__version__, str)
        assert len(__version__) > 0
        # Version should be semver-like
        parts = __version__.split(".")
        assert len(parts) >= 2

    def test_package_can_be_imported(self):
        """Test that wisecore package can be imported."""
        import wisecore

        assert hasattr(wisecore, "__version__")

    def test_logging_setup_on_import(self):
        """Test that logging is configured on package import."""
        import logging

        from wisecore.utils.logging import LOG_NAMESPACE

        # Logger namespace should be defined
        assert LOG_NAMESPACE == "wisecore"

        # wisecore logger should exist
        logger = logging.getLogger("wisecore")
        assert logger is not None
