# -*- coding: utf-8 -*-
"""Unit tests for channel schema module."""

from __future__ import annotations

import pytest

from wisecore.app.channels.schema import (
    ChannelAddress,
    BUILTIN_CHANNEL_TYPES,
    DEFAULT_CHANNEL,
    ChannelType,
    ChannelMessageConverter,
)


class TestChannelAddress:
    """Tests for ChannelAddress dataclass."""

    def test_create_address_with_kind_and_id(self):
        """Test creating ChannelAddress with kind and id."""
        addr = ChannelAddress(kind="dm", id="user123")

        assert addr.kind == "dm"
        assert addr.id == "user123"
        assert addr.extra is None

    def test_create_address_with_extra(self):
        """Test creating ChannelAddress with extra data."""
        addr = ChannelAddress(
            kind="webhook",
            id="hook456",
            extra={"session_webhook": "https://example.com/webhook"},
        )

        assert addr.kind == "webhook"
        assert addr.id == "hook456"
        assert addr.extra["session_webhook"] == "https://example.com/webhook"

    def test_to_handle_default(self):
        """Test to_handle returns kind:id by default."""
        addr = ChannelAddress(kind="discord", id="channel789")

        result = addr.to_handle()

        assert result == "discord:channel789"

    def test_to_handle_with_extra_to_handle(self):
        """Test to_handle returns extra['to_handle'] when present."""
        addr = ChannelAddress(
            kind="dm",
            id="user123",
            extra={"to_handle": "custom_handle"},
        )

        result = addr.to_handle()

        assert result == "custom_handle"

    def test_to_handle_with_extra_but_no_to_handle(self):
        """Test to_handle returns kind:id when extra exists but no to_handle."""
        addr = ChannelAddress(
            kind="telegram",
            id="chat456",
            extra={"other_key": "value"},
        )

        result = addr.to_handle()

        assert result == "telegram:chat456"


class TestBuiltinChannelTypes:
    """Tests for built-in channel type constants."""

    def test_builtin_types_exist(self):
        """Test that expected builtin channel types are defined."""
        expected = [
            "imessage",
            "discord",
            "dingtalk",
            "feishu",
            "qq",
            "telegram",
            "mqtt",
            "console",
            "voice",
            "xiaoyi",
        ]

        for channel_type in expected:
            assert channel_type in BUILTIN_CHANNEL_TYPES

    def test_builtin_types_is_tuple(self):
        """Test that BUILTIN_CHANNEL_TYPES is a tuple."""
        assert isinstance(BUILTIN_CHANNEL_TYPES, tuple)

    def test_default_channel_is_console(self):
        """Test that default channel is console."""
        assert DEFAULT_CHANNEL == "console"

    def test_default_channel_is_builtin(self):
        """Test that default channel is in builtin types."""
        assert DEFAULT_CHANNEL in BUILTIN_CHANNEL_TYPES


class TestChannelType:
    """Tests for ChannelType alias."""

    def test_channel_type_is_str(self):
        """Test that ChannelType is str type."""
        channel_type: ChannelType = "custom_channel"
        assert isinstance(channel_type, str)


class TestChannelMessageConverter:
    """Tests for ChannelMessageConverter protocol."""

    def test_protocol_is_runtime_checkable(self):
        """Test that protocol can be checked at runtime."""

        class MockConverter:
            def build_agent_request_from_native(self, native_payload):
                return None

            async def send_response(self, to_handle, response, meta=None):
                pass

        converter = MockConverter()
        assert isinstance(converter, ChannelMessageConverter)
