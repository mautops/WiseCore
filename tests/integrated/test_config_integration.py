# -*- coding: utf-8 -*-
"""Integration tests for configuration loading and saving."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest


class TestConfigIntegration:
    """Integration tests for configuration system."""

    @pytest.mark.integration
    def test_load_save_config_roundtrip(self, integration_temp_dir: Path):
        """Test that config can be saved and loaded correctly."""
        from wisecore.config.utils import load_config, save_config

        config_path = integration_temp_dir / "config.json"

        # Create default config
        config = load_config(config_path)

        # Modify some values
        config.show_tool_details = False
        config.security.tool_guard.enabled = False

        # Save
        save_config(config, config_path)

        # Verify file exists
        assert config_path.exists()

        # Load again
        loaded_config = load_config(config_path)

        # Verify values persisted
        assert loaded_config.show_tool_details is False
        assert loaded_config.security.tool_guard.enabled is False

    @pytest.mark.integration
    def test_config_with_channel_settings(self, integration_temp_dir: Path):
        """Test config with channel-specific settings."""
        from wisecore.config.utils import load_config, save_config

        config_path = integration_temp_dir / "config.json"

        config = load_config(config_path)

        # Modify channel settings
        config.channels.discord.enabled = True
        config.channels.discord.bot_token = "test_token"
        config.channels.telegram.enabled = True

        save_config(config, config_path)

        # Load and verify
        loaded = load_config(config_path)
        assert loaded.channels.discord.enabled is True
        assert loaded.channels.discord.bot_token == "test_token"

    @pytest.mark.integration
    def test_config_maintains_defaults_for_unset_fields(
        self, integration_temp_dir: Path
    ):
        """Test that unset fields maintain defaults after save/load."""
        from wisecore.config.utils import load_config, save_config

        config_path = integration_temp_dir / "config.json"

        config = load_config(config_path)
        save_config(config, config_path)

        # Load again
        loaded = load_config(config_path)

        # Check defaults are maintained
        assert loaded.channels.console.enabled is True
        assert loaded.security.tool_guard.enabled is True


class TestAgentConfigIntegration:
    """Integration tests for agent-specific configuration."""

    @pytest.mark.integration
    def test_agent_config_roundtrip(self, integration_temp_dir: Path):
        """Test that agent config can be saved and loaded."""
        from wisecore.config.config import (
            AgentProfileConfig,
            save_agent_config,
            load_agent_config,
        )
        from wisecore.config.utils import load_config, save_config, get_config_path

        # Set up workspace directory
        workspace_dir = integration_temp_dir / "workspaces" / "test-agent"
        workspace_dir.mkdir(parents=True, exist_ok=True)

        # Save the config to the expected location first
        config_path = get_config_path()
        config_path.parent.mkdir(parents=True, exist_ok=True)

        config = load_config()
        config.agents.profiles["test-agent"] = config.agents.profiles[
            "default"
        ].model_copy(
            update={
                "id": "test-agent",
                "workspace_dir": str(workspace_dir),
            }
        )
        save_config(config)

        # Create agent config
        agent_config = AgentProfileConfig(
            id="test-agent",
            name="Test Agent",
            description="A test agent for integration testing",
            workspace_dir=str(workspace_dir),
        )

        save_agent_config("test-agent", agent_config)

        # Load and verify
        loaded = load_agent_config("test-agent")
        assert loaded.id == "test-agent"
        assert loaded.name == "Test Agent"


class TestEnvironmentVariablesIntegration:
    """Integration tests for environment variable handling."""

    @pytest.mark.integration
    def test_env_store_roundtrip(self, integration_temp_dir: Path):
        """Test that environment variables can be stored and loaded."""
        from wisecore.envs.store import save_envs, load_envs

        envs_path = integration_temp_dir / "envs.json"

        test_envs = {
            "TEST_API_KEY": "test-key-123",
            "TEST_ENDPOINT": "https://api.example.com",
            "TEST_FLAG": "true",
        }

        save_envs(test_envs, envs_path)

        # Load and verify
        loaded = load_envs(envs_path)
        assert loaded["TEST_API_KEY"] == "test-key-123"
        assert loaded["TEST_ENDPOINT"] == "https://api.example.com"

    @pytest.mark.integration
    def test_env_load_into_environ(self, integration_temp_dir: Path):
        """Test loading environment variables into os.environ."""
        import os
        from wisecore.envs.store import save_envs, load_envs_into_environ

        envs_path = integration_temp_dir / "envs.json"

        save_envs({"INTEGRATION_TEST_VAR": "test_value"}, envs_path)

        with patch("wisecore.envs.store.get_envs_json_path", return_value=envs_path):
            load_envs_into_environ()

        assert os.environ.get("INTEGRATION_TEST_VAR") == "test_value"

        # Cleanup
        os.environ.pop("INTEGRATION_TEST_VAR", None)
