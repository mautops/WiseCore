# -*- coding: utf-8 -*-
"""Unit tests for environment variables store."""

from __future__ import annotations

import json
import os
from pathlib import Path
from unittest.mock import patch

import pytest


class TestEnvsStore:
    """Tests for environment variables storage."""

    def test_load_envs_returns_empty_when_no_file(self, temp_dir: Path):
        """Test that load_envs returns empty dict when file doesn't exist."""
        from wisecore.envs.store import load_envs

        with patch(
            "wisecore.envs.store.get_envs_json_path",
            return_value=temp_dir / "nonexistent.json",
        ):
            result = load_envs()
            assert result == {}

    def test_save_and_load_envs(self, temp_dir: Path):
        """Test saving and loading environment variables."""
        from wisecore.envs.store import load_envs, save_envs

        envs_path = temp_dir / "envs.json"

        test_envs = {
            "TEST_KEY": "test_value",
            "ANOTHER_KEY": "another_value",
        }

        save_envs(test_envs, envs_path)
        assert envs_path.exists()

        loaded = load_envs(envs_path)
        assert loaded == test_envs

    def test_load_envs_into_environ(self, temp_dir: Path):
        """Test loading envs into os.environ."""
        from wisecore.envs.store import load_envs_into_environ, save_envs

        envs_path = temp_dir / "envs.json"
        test_envs = {"MY_TEST_VAR": "my_test_value"}

        save_envs(test_envs, envs_path)

        with patch(
            "wisecore.envs.store.get_envs_json_path",
            return_value=envs_path,
        ):
            loaded = load_envs_into_environ()

        assert "MY_TEST_VAR" in loaded
        assert os.environ.get("MY_TEST_VAR") == "my_test_value"

        # Cleanup
        os.environ.pop("MY_TEST_VAR", None)

    def test_set_env_var(self, temp_dir: Path):
        """Test setting a single environment variable."""
        from wisecore.envs.store import set_env_var

        envs_path = temp_dir / "envs.json"

        with patch(
            "wisecore.envs.store.get_envs_json_path",
            return_value=envs_path,
        ):
            result = set_env_var("NEW_VAR", "new_value")

        assert "NEW_VAR" in result
        assert result["NEW_VAR"] == "new_value"
        assert os.environ.get("NEW_VAR") == "new_value"

        # Cleanup
        os.environ.pop("NEW_VAR", None)

    def test_delete_env_var(self, temp_dir: Path):
        """Test deleting an environment variable."""
        from wisecore.envs.store import delete_env_var, set_env_var

        envs_path = temp_dir / "envs.json"

        with patch(
            "wisecore.envs.store.get_envs_json_path",
            return_value=envs_path,
        ):
            set_env_var("TO_DELETE", "value")
            result = delete_env_var("TO_DELETE")

        assert "TO_DELETE" not in result

    def test_protected_bootstrap_keys_not_overwritten(self, temp_dir: Path):
        """Test that protected bootstrap keys are not overwritten."""
        from wisecore.envs.store import load_envs_into_environ, save_envs

        envs_path = temp_dir / "envs.json"

        # Save with protected keys
        test_envs = {
            "WORKING_DIR": "/should/not/override",
            "NORMAL_VAR": "normal_value",
        }
        save_envs(test_envs, envs_path)

        # Set a different value in environment
        original_value = "/original/value"
        os.environ["WORKING_DIR"] = original_value

        with patch(
            "wisecore.envs.store.get_envs_json_path",
            return_value=envs_path,
        ):
            load_envs_into_environ()

        # Protected key should not be overwritten
        assert os.environ.get("WORKING_DIR") == original_value

        # Cleanup
        os.environ.pop("WORKING_DIR", None)
        os.environ.pop("NORMAL_VAR", None)
