# -*- coding: utf-8 -*-
"""Unit tests for CLI utilities."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


class TestPromptConfirm:
    """Tests for prompt_confirm function."""

    def test_prompt_confirm_returns_true(self):
        """Test prompt_confirm returns True for Yes."""
        from wisecore.cli.utils import prompt_confirm

        with patch("wisecore.cli.utils.questionary") as mock_questionary:
            mock_questionary.Choice = MagicMock()
            mock_questionary.Choice.side_effect = lambda title, value: MagicMock(
                title=title,
                value=value,
            )
            mock_select = MagicMock()
            mock_select.ask.return_value = True
            mock_questionary.select.return_value = mock_select

            result = prompt_confirm("Continue?", default=False)

            assert result is True

    def test_prompt_confirm_returns_false(self):
        """Test prompt_confirm returns False for No."""
        from wisecore.cli.utils import prompt_confirm

        with patch("wisecore.cli.utils.questionary") as mock_questionary:
            mock_questionary.Choice = MagicMock()
            mock_questionary.Choice.side_effect = lambda title, value: MagicMock(
                title=title,
                value=value,
            )
            mock_select = MagicMock()
            mock_select.ask.return_value = False
            mock_questionary.select.return_value = mock_select

            result = prompt_confirm("Continue?", default=True)

            assert result is False

    def test_prompt_confirm_returns_default_on_ctrl_c(self):
        """Test prompt_confirm returns default on Ctrl+C."""
        from wisecore.cli.utils import prompt_confirm

        with patch("wisecore.cli.utils.questionary") as mock_questionary:
            mock_questionary.Choice = MagicMock()
            mock_questionary.Choice.side_effect = lambda title, value: MagicMock(
                title=title,
                value=value,
            )
            mock_select = MagicMock()
            mock_select.ask.return_value = None  # Ctrl+C
            mock_questionary.select.return_value = mock_select

            result = prompt_confirm("Continue?", default=True)

            assert result is True


class TestPromptChoice:
    """Tests for prompt_choice function."""

    def test_prompt_choice_returns_selection(self):
        """Test prompt_choice returns selected value."""
        from wisecore.cli.utils import prompt_choice

        with patch("wisecore.cli.utils.questionary") as mock_questionary:
            mock_questionary.Choice = MagicMock()
            mock_questionary.Choice.side_effect = lambda opt, value: MagicMock(
                title=opt,
                value=value,
            )
            mock_select = MagicMock()
            mock_select.ask.return_value = "option2"
            mock_questionary.select.return_value = mock_select

            result = prompt_choice(
                "Pick one:",
                ["option1", "option2", "option3"],
            )

            assert result == "option2"

    def test_prompt_choice_returns_default_on_ctrl_c(self):
        """Test prompt_choice returns default on Ctrl+C."""
        from wisecore.cli.utils import prompt_choice

        with patch("wisecore.cli.utils.questionary") as mock_questionary:
            mock_questionary.Choice = MagicMock()
            mock_questionary.Choice.side_effect = lambda opt, value: MagicMock(
                title=opt,
                value=value,
            )
            mock_select = MagicMock()
            mock_select.ask.return_value = None  # Ctrl+C
            mock_questionary.select.return_value = mock_select

            result = prompt_choice(
                "Pick one:",
                ["option1", "option2"],
                default="option2",
            )

            assert result == "option2"

    def test_prompt_choice_returns_first_on_ctrl_c_no_default(self):
        """Test prompt_choice returns first option on Ctrl+C without default."""
        from wisecore.cli.utils import prompt_choice

        with patch("wisecore.cli.utils.questionary") as mock_questionary:
            mock_questionary.Choice = MagicMock()
            mock_questionary.Choice.side_effect = lambda opt, value: MagicMock(
                title=opt,
                value=value,
            )
            mock_select = MagicMock()
            mock_select.ask.return_value = None  # Ctrl+C
            mock_questionary.select.return_value = mock_select

            result = prompt_choice(
                "Pick one:",
                ["option1", "option2"],
            )

            assert result == "option1"


class TestPromptSelect:
    """Tests for prompt_select function."""

    def test_prompt_select_returns_value(self):
        """Test prompt_select returns selected value."""
        from wisecore.cli.utils import prompt_select

        with patch("wisecore.cli.utils.questionary") as mock_questionary:
            mock_questionary.Choice = MagicMock()
            mock_questionary.Choice.side_effect = lambda label, value: MagicMock(
                title=label,
                value=value,
            )
            mock_select = MagicMock()
            mock_select.ask.return_value = "value2"
            mock_questionary.select.return_value = mock_select

            result = prompt_select(
                "Pick one:",
                [("Label 1", "value1"), ("Label 2", "value2")],
            )

            assert result == "value2"

    def test_prompt_select_returns_none_on_ctrl_c(self):
        """Test prompt_select returns None on Ctrl+C."""
        from wisecore.cli.utils import prompt_select

        with patch("wisecore.cli.utils.questionary") as mock_questionary:
            mock_questionary.Choice = MagicMock()
            mock_questionary.Choice.side_effect = lambda label, value: MagicMock(
                title=label,
                value=value,
            )
            mock_select = MagicMock()
            mock_select.ask.return_value = None  # Ctrl+C
            mock_questionary.select.return_value = mock_select

            result = prompt_select(
                "Pick one:",
                [("Label 1", "value1")],
            )

            assert result is None


class TestPromptCheckbox:
    """Tests for prompt_checkbox function."""

    def test_prompt_checkbox_returns_selections(self):
        """Test prompt_checkbox returns selected values."""
        from wisecore.cli.utils import prompt_checkbox

        with patch("wisecore.cli.utils.questionary") as mock_questionary:
            mock_questionary.Choice = MagicMock()

            def create_choice(title, value, checked=False):
                m = MagicMock()
                m.title = title
                m.value = value
                m.checked = checked
                return m

            mock_questionary.Choice.side_effect = create_choice

            mock_checkbox = MagicMock()
            mock_checkbox.ask.return_value = ["val1", "val3"]
            mock_questionary.checkbox.return_value = mock_checkbox

            result = prompt_checkbox(
                "Select items:",
                [("Item 1", "val1"), ("Item 2", "val2"), ("Item 3", "val3")],
                select_all_option=False,
            )

            assert result == ["val1", "val3"]

    def test_prompt_checkbox_returns_none_on_ctrl_c(self):
        """Test prompt_checkbox returns None on Ctrl+C."""
        from wisecore.cli.utils import prompt_checkbox

        with patch("wisecore.cli.utils.questionary") as mock_questionary:
            mock_questionary.Choice = MagicMock()

            def create_choice(title, value, checked=False):
                m = MagicMock()
                m.title = title
                m.value = value
                m.checked = checked
                return m

            mock_questionary.Choice.side_effect = create_choice

            mock_checkbox = MagicMock()
            mock_checkbox.ask.return_value = None  # Ctrl+C
            mock_questionary.checkbox.return_value = mock_checkbox

            result = prompt_checkbox(
                "Select items:",
                [("Item 1", "val1")],
            )

            assert result is None

    def test_prompt_checkbox_with_prechecked(self):
        """Test prompt_checkbox with pre-checked items."""
        from wisecore.cli.utils import prompt_checkbox

        with patch("wisecore.cli.utils.questionary") as mock_questionary:
            mock_questionary.Choice = MagicMock()

            def create_choice(title, value, checked=False):
                m = MagicMock()
                m.title = title
                m.value = value
                m.checked = checked
                return m

            mock_questionary.Choice.side_effect = create_choice

            mock_checkbox = MagicMock()
            mock_checkbox.ask.return_value = ["val1"]
            mock_questionary.checkbox.return_value = mock_checkbox

            result = prompt_checkbox(
                "Select items:",
                [("Item 1", "val1"), ("Item 2", "val2")],
                checked={"val2"},  # Pre-checked
                select_all_option=False,
            )

            assert "val1" in result


class TestPromptPath:
    """Tests for prompt_path function."""

    def test_prompt_path_returns_existing_path(self, temp_dir: Path):
        """Test prompt_path returns resolved existing path."""
        from wisecore.cli.utils import prompt_path

        test_file = temp_dir / "test.txt"
        test_file.touch()

        with patch("wisecore.cli.utils.click") as mock_click:
            mock_click.prompt.return_value = str(test_file)

            result = prompt_path("Enter path:")

            assert Path(result).exists()
            assert Path(result).name == "test.txt"

    def test_prompt_path_returns_empty_string(self):
        """Test prompt_path returns empty string when input is empty."""
        from wisecore.cli.utils import prompt_path

        with patch("wisecore.cli.utils.click") as mock_click:
            mock_click.prompt.return_value = ""

            result = prompt_path("Enter path:")

            assert result == ""

    def test_prompt_path_nonexistent_continue(self):
        """Test prompt_path handles nonexistent path with continue."""
        from wisecore.cli.utils import prompt_path

        with patch("wisecore.cli.utils.click") as mock_click, patch(
            "wisecore.cli.utils.prompt_confirm",
        ) as mock_confirm:
            mock_click.prompt.return_value = "/nonexistent/path"
            mock_confirm.return_value = True  # Continue anyway

            result = prompt_path("Enter path:")

            assert result == "/nonexistent/path"
