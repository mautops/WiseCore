# -*- coding: utf-8 -*-
"""Unit tests for agents schema module."""

from __future__ import annotations

import pytest


class TestFileBlock:
    """Tests for FileBlock TypedDict."""

    def test_file_block_structure(self):
        """Test that FileBlock has expected structure."""
        from wisecore.agents.schema import FileBlock

        # FileBlock is a TypedDict, verify it can be created
        file_block: FileBlock = {
            "type": "file",
            "source": {"url": "https://example.com/file.pdf"},
        }

        assert file_block["type"] == "file"
        assert file_block["source"]["url"] == "https://example.com/file.pdf"

    def test_file_block_with_filename(self):
        """Test FileBlock with filename."""
        from wisecore.agents.schema import FileBlock

        file_block: FileBlock = {
            "type": "file",
            "source": {"url": "https://example.com/file.pdf"},
            "filename": "document.pdf",
        }

        assert file_block["filename"] == "document.pdf"

    def test_file_block_with_base64_source(self):
        """Test FileBlock with base64 source."""
        from wisecore.agents.schema import FileBlock

        file_block: FileBlock = {
            "type": "file",
            "source": {
                "media_type": "application/pdf",
                "data": "base64encodeddata",
            },
        }

        assert file_block["source"]["media_type"] == "application/pdf"
        assert file_block["source"]["data"] == "base64encodeddata"
