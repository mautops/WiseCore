# -*- coding: utf-8 -*-
"""Unit tests for config models."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

from wisecore.config.config import (
    generate_short_agent_id,
    BaseChannelConfig,
    ChannelConfig,
    ConsoleConfig,
    DiscordConfig,
    DingTalkConfig,
    FeishuConfig,
    HeartbeatConfig,
    ActiveHoursConfig,
    AgentsRunningConfig,
    AgentsLLMRoutingConfig,
    ToolGuardConfig,
    ToolGuardRuleConfig,
    FileGuardConfig,
    SkillScannerConfig,
    SecurityConfig,
    BuiltinToolConfig,
    ToolsConfig,
    _default_builtin_tools,
    build_qa_agent_tools_config,
    MCPClientConfig,
    MCPConfig,
    Config,
    AgentProfileRef,
    AgentProfileConfig,
    AgentsConfig,
)


class TestGenerateShortAgentId:
    """Tests for generate_short_agent_id function."""

    def test_returns_string(self):
        """Test that function returns a string."""
        result = generate_short_agent_id()
        assert isinstance(result, str)

    def test_returns_six_characters(self):
        """Test that ID is 6 characters."""
        result = generate_short_agent_id()
        assert len(result) == 6

    def test_returns_unique_ids(self):
        """Test that multiple calls return unique IDs."""
        ids = {generate_short_agent_id() for _ in range(100)}
        assert len(ids) > 90  # Allow for rare collisions


class TestBaseChannelConfig:
    """Tests for BaseChannelConfig."""

    def test_default_values(self):
        """Test default values."""
        config = BaseChannelConfig()
        assert config.enabled is False
        assert config.bot_prefix == ""
        assert config.filter_tool_messages is False
        assert config.filter_thinking is False
        assert config.dm_policy == "open"
        assert config.group_policy == "open"
        assert config.allow_from == []
        assert config.deny_message == ""
        assert config.require_mention is False


class TestConsoleConfig:
    """Tests for ConsoleConfig."""

    def test_default_enabled(self):
        """Test that console is enabled by default."""
        config = ConsoleConfig()
        assert config.enabled is True

    def test_media_dir_optional(self):
        """Test that media_dir is optional."""
        config = ConsoleConfig()
        assert config.media_dir is None


class TestDiscordConfig:
    """Tests for DiscordConfig."""

    def test_default_values(self):
        """Test default values."""
        config = DiscordConfig()
        assert config.bot_token == ""
        assert config.http_proxy == ""
        assert config.http_proxy_auth == ""


class TestDingTalkConfig:
    """Tests for DingTalkConfig."""

    def test_default_values(self):
        """Test default values."""
        config = DingTalkConfig()
        assert config.client_id == ""
        assert config.client_secret == ""
        assert config.message_type == "markdown"
        assert config.card_auto_layout is False


class TestFeishuConfig:
    """Tests for FeishuConfig."""

    def test_default_values(self):
        """Test default values."""
        config = FeishuConfig()
        assert config.app_id == ""
        assert config.app_secret == ""
        assert config.domain == "feishu"


class TestHeartbeatConfig:
    """Tests for HeartbeatConfig."""

    def test_default_values(self):
        """Test default values."""
        config = HeartbeatConfig()
        assert config.enabled is False

    def test_active_hours_alias(self):
        """Test activeHours alias."""
        config = HeartbeatConfig(activeHours=ActiveHoursConfig())
        assert config.active_hours is not None


class TestActiveHoursConfig:
    """Tests for ActiveHoursConfig."""

    def test_default_values(self):
        """Test default values."""
        config = ActiveHoursConfig()
        assert config.start == "08:00"
        assert config.end == "22:00"


class TestAgentsRunningConfig:
    """Tests for AgentsRunningConfig."""

    def test_default_values(self):
        """Test default values."""
        config = AgentsRunningConfig()
        assert config.max_iters == 100
        assert config.token_count_model == "default"
        assert config.token_count_estimate_divisor == 3.75
        assert config.max_input_length == 128 * 1024

    def test_memory_compact_threshold_property(self):
        """Test memory_compact_threshold property."""
        config = AgentsRunningConfig()
        expected = int(config.max_input_length * config.memory_compact_ratio)
        assert config.memory_compact_threshold == expected

    def test_memory_compact_reserve_property(self):
        """Test memory_compact_reserve property."""
        config = AgentsRunningConfig()
        expected = int(config.max_input_length * config.memory_reserve_ratio)
        assert config.memory_compact_reserve == expected

    def test_llm_retry_validation(self):
        """Test LLM retry backoff validation."""
        with pytest.raises(ValueError):
            AgentsRunningConfig(
                llm_backoff_base=10.0,
                llm_backoff_cap=5.0,  # cap < base should fail
            )


class TestAgentsLLMRoutingConfig:
    """Tests for AgentsLLMRoutingConfig."""

    def test_default_values(self):
        """Test default values."""
        config = AgentsLLMRoutingConfig()
        assert config.enabled is False
        assert config.mode == "local_first"


class TestToolGuardConfig:
    """Tests for ToolGuardConfig."""

    def test_default_values(self):
        """Test default values."""
        config = ToolGuardConfig()
        assert config.enabled is True
        assert config.guarded_tools is None
        assert config.denied_tools == []
        assert config.custom_rules == []


class TestToolGuardRuleConfig:
    """Tests for ToolGuardRuleConfig."""

    def test_create_rule(self):
        """Test creating a guard rule."""
        rule = ToolGuardRuleConfig(
            id="RULE_001",
            tools=["execute_shell_command"],
            params=["command"],
            category="command_injection",
            severity="HIGH",
            patterns=["rm -rf"],
        )
        assert rule.id == "RULE_001"
        assert rule.tools == ["execute_shell_command"]
        assert rule.patterns == ["rm -rf"]


class TestFileGuardConfig:
    """Tests for FileGuardConfig."""

    def test_default_values(self):
        """Test default values."""
        config = FileGuardConfig()
        assert config.enabled is True
        assert config.sensitive_files == []


class TestSkillScannerConfig:
    """Tests for SkillScannerConfig."""

    def test_default_values(self):
        """Test default values."""
        config = SkillScannerConfig()
        assert config.mode == "warn"
        assert config.timeout == 30
        assert config.whitelist == []

    def test_mode_values(self):
        """Test valid mode values."""
        for mode in ["block", "warn", "off"]:
            config = SkillScannerConfig(mode=mode)
            assert config.mode == mode


class TestSecurityConfig:
    """Tests for SecurityConfig."""

    def test_default_values(self):
        """Test default values."""
        config = SecurityConfig()
        assert config.tool_guard.enabled is True
        assert config.file_guard.enabled is True
        assert config.skill_scanner.mode == "warn"


class TestBuiltinToolConfig:
    """Tests for BuiltinToolConfig."""

    def test_create_tool_config(self):
        """Test creating a tool config."""
        tool = BuiltinToolConfig(
            name="test_tool",
            enabled=True,
            description="A test tool",
        )
        assert tool.name == "test_tool"
        assert tool.enabled is True
        assert tool.display_to_user is True


class TestToolsConfig:
    """Tests for ToolsConfig."""

    def test_default_has_builtin_tools(self):
        """Test that default has builtin tools."""
        config = ToolsConfig()
        assert "execute_shell_command" in config.builtin_tools
        assert "read_file" in config.builtin_tools
        assert "write_file" in config.builtin_tools

    def test_merge_default_tools(self):
        """Test that new tools are merged with defaults."""
        config = ToolsConfig(
            builtin_tools={
                "custom_tool": BuiltinToolConfig(
                    name="custom_tool",
                    enabled=True,
                ),
            },
        )
        # Default tools should still be present
        assert "execute_shell_command" in config.builtin_tools
        # Custom tool should also be present
        assert "custom_tool" in config.builtin_tools


class TestDefaultBuiltinTools:
    """Tests for _default_builtin_tools function."""

    def test_returns_dict(self):
        """Test that function returns a dict."""
        tools = _default_builtin_tools()
        assert isinstance(tools, dict)

    def test_contains_expected_tools(self):
        """Test that expected tools are present."""
        tools = _default_builtin_tools()
        expected = [
            "execute_shell_command",
            "read_file",
            "write_file",
            "edit_file",
            "grep_search",
            "glob_search",
            "browser_use",
        ]
        for tool_name in expected:
            assert tool_name in tools


class TestBuildQaAgentToolsConfig:
    """Tests for build_qa_agent_tools_config function."""

    def test_returns_tools_config(self):
        """Test that function returns ToolsConfig."""
        config = build_qa_agent_tools_config()
        assert isinstance(config, ToolsConfig)

    def test_only_allowed_tools_enabled(self):
        """Test that only allowed tools are enabled."""
        config = build_qa_agent_tools_config()
        allowed = {
            "execute_shell_command",
            "read_file",
            "write_file",
            "edit_file",
            "view_image",
        }
        for name, tool in config.builtin_tools.items():
            if name in allowed:
                assert tool.enabled, f"{name} should be enabled"
            else:
                assert not tool.enabled, f"{name} should be disabled"


class TestMCPClientConfig:
    """Tests for MCPClientConfig."""

    def test_create_stdio_client(self):
        """Test creating stdio MCP client."""
        client = MCPClientConfig(
            name="test_client",
            transport="stdio",
            command="npx",
            args=["-y", "test-mcp"],
        )
        assert client.name == "test_client"
        assert client.transport == "stdio"
        assert client.command == "npx"

    def test_create_http_client(self):
        """Test creating HTTP MCP client."""
        client = MCPClientConfig(
            name="http_client",
            transport="streamable_http",
            url="http://localhost:8080/mcp",
        )
        assert client.transport == "streamable_http"
        assert client.url == "http://localhost:8080/mcp"

    def test_stdio_requires_command(self):
        """Test that stdio requires command."""
        with pytest.raises(ValueError):
            MCPClientConfig(
                name="bad_client",
                transport="stdio",
                command="",  # Empty command should fail
            )

    def test_http_requires_url(self):
        """Test that HTTP requires URL."""
        with pytest.raises(ValueError):
            MCPClientConfig(
                name="bad_http",
                transport="streamable_http",
                url="",  # Empty URL should fail
            )

    def test_legacy_field_normalization(self):
        """Test normalization of legacy field names."""
        # isActive -> enabled
        client = MCPClientConfig(
            name="test",
            transport="stdio",
            command="test",
            isActive=True,
        )
        assert client.enabled is True

        # baseUrl -> url
        client = MCPClientConfig(
            name="test",
            transport="streamable_http",
            baseUrl="http://example.com",
        )
        assert client.url == "http://example.com"

    def test_transport_alias_normalization(self):
        """Test normalization of transport aliases."""
        client = MCPClientConfig(
            name="test",
            transport="StreamableHttp",
            url="http://example.com",
        )
        assert client.transport == "streamable_http"


class TestMCPConfig:
    """Tests for MCPConfig."""

    def test_default_has_tavily_search(self):
        """Test that default includes tavily_search client."""
        config = MCPConfig()
        assert "tavily_search" in config.clients

    def test_tavily_enabled_with_api_key(self):
        """Test tavily is enabled when API key exists."""
        with patch.dict("os.environ", {"TAVILY_API_KEY": "test-key"}, clear=False):
            config = MCPConfig()
            assert config.clients["tavily_search"].enabled is True


class TestChannelConfig:
    """Tests for ChannelConfig."""

    def test_default_values(self):
        """Test default values."""
        config = ChannelConfig()
        assert config.console.enabled is True
        assert config.discord.enabled is False
        assert config.telegram.enabled is False

    def test_extra_fields_allowed(self):
        """Test that extra fields are allowed."""
        config = ChannelConfig(
            custom_channel={"enabled": True},  # type: ignore
        )
        assert config.model_dump().get("custom_channel") == {"enabled": True}


class TestAgentProfileRef:
    """Tests for AgentProfileRef."""

    def test_create_profile_ref(self):
        """Test creating profile reference."""
        ref = AgentProfileRef(
            id="test-agent",
            workspace_dir="/workspaces/test",
        )
        assert ref.id == "test-agent"
        assert ref.workspace_dir == "/workspaces/test"


class TestAgentProfileConfig:
    """Tests for AgentProfileConfig."""

    def test_create_profile(self):
        """Test creating agent profile."""
        profile = AgentProfileConfig(
            id="test-agent",
            name="Test Agent",
            description="A test agent",
        )
        assert profile.id == "test-agent"
        assert profile.name == "Test Agent"
        assert profile.language == "zh"
        assert profile.system_prompt_files == ["AGENTS.md", "SOUL.md", "PROFILE.md"]


class TestAgentsConfig:
    """Tests for AgentsConfig."""

    def test_default_values(self):
        """Test default values."""
        config = AgentsConfig()
        assert config.active_agent == "default"
        assert "default" in config.profiles

    def test_audio_mode_default(self):
        """Test audio mode default."""
        config = AgentsConfig()
        assert config.audio_mode == "auto"

    def test_transcription_default(self):
        """Test transcription defaults."""
        config = AgentsConfig()
        assert config.transcription_provider_type == "disabled"


class TestConfig:
    """Tests for root Config."""

    def test_default_values(self):
        """Test default values."""
        config = Config()
        assert config.show_tool_details is True
        assert config.security.tool_guard.enabled is True

    def test_user_timezone_default(self):
        """Test that user_timezone has a default."""
        config = Config()
        assert config.user_timezone != ""

    def test_channels_default(self):
        """Test that channels have default config."""
        config = Config()
        assert config.channels is not None
        assert config.channels.console.enabled is True
