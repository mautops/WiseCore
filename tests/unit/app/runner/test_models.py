# -*- coding: utf-8 -*-
"""Unit tests for runner models."""

from __future__ import annotations

from datetime import datetime

import pytest

from wisecore.app.runner.models import (
    ChatSpec,
    ChatHistory,
    ChatsFile,
)
from wisecore.app.channels.schema import DEFAULT_CHANNEL


class TestChatSpec:
    """Tests for ChatSpec model."""

    def test_create_chat_spec_with_required_fields(self):
        """Test creating ChatSpec with required fields."""
        spec = ChatSpec(
            session_id="console:user123",
            user_id="user123",
        )

        assert spec.session_id == "console:user123"
        assert spec.user_id == "user123"
        assert spec.name == "New Chat"
        assert spec.channel == DEFAULT_CHANNEL

    def test_chat_spec_has_uuid_id(self):
        """Test that ChatSpec has UUID id."""
        spec = ChatSpec(
            session_id="console:user123",
            user_id="user123",
        )

        assert spec.id is not None
        assert len(spec.id) == 36  # UUID format
        assert "-" in spec.id

    def test_chat_spec_ids_are_unique(self):
        """Test that ChatSpec IDs are unique."""
        specs = [
            ChatSpec(session_id="console:user", user_id="user")
            for _ in range(10)
        ]

        ids = {s.id for s in specs}
        assert len(ids) == 10

    def test_chat_spec_timestamps(self):
        """Test that ChatSpec has timestamps."""
        spec = ChatSpec(
            session_id="console:user123",
            user_id="user123",
        )

        assert isinstance(spec.created_at, datetime)
        assert isinstance(spec.updated_at, datetime)

    def test_chat_spec_with_custom_values(self):
        """Test ChatSpec with custom values."""
        spec = ChatSpec(
            session_id="discord:channel456",
            user_id="user456",
            name="My Chat",
            channel="discord",
            status="running",
        )

        assert spec.name == "My Chat"
        assert spec.channel == "discord"
        assert spec.status == "running"

    def test_chat_spec_with_meta(self):
        """Test ChatSpec with metadata."""
        spec = ChatSpec(
            session_id="console:user123",
            user_id="user123",
            meta={"key": "value", "number": 42},
        )

        assert spec.meta["key"] == "value"
        assert spec.meta["number"] == 42

    def test_chat_spec_status_default(self):
        """Test ChatSpec status default is idle."""
        spec = ChatSpec(
            session_id="console:user123",
            user_id="user123",
        )

        assert spec.status == "idle"


class TestChatHistory:
    """Tests for ChatHistory model."""

    def test_create_empty_chat_history(self):
        """Test creating empty ChatHistory."""
        history = ChatHistory()

        assert history.messages == []
        assert history.status == "idle"

    def test_chat_history_with_status(self):
        """Test ChatHistory with status."""
        history = ChatHistory(status="running")

        assert history.status == "running"


class TestChatsFile:
    """Tests for ChatsFile model."""

    def test_create_empty_chats_file(self):
        """Test creating empty ChatsFile."""
        chats_file = ChatsFile()

        assert chats_file.version == 1
        assert chats_file.chats == []

    def test_chats_file_with_chats(self):
        """Test ChatsFile with chats."""
        spec = ChatSpec(
            session_id="console:user123",
            user_id="user123",
        )

        chats_file = ChatsFile(chats=[spec])

        assert len(chats_file.chats) == 1
        assert chats_file.chats[0].user_id == "user123"

    def test_chats_file_version(self):
        """Test ChatsFile version."""
        chats_file = ChatsFile()

        assert chats_file.version == 1
