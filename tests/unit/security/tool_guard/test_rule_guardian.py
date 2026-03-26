# -*- coding: utf-8 -*-
"""Unit tests for rule-based tool guardian."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from wisecore.security.tool_guard.guardians.rule_guardian import (
    GuardRule,
    load_rules_from_yaml,
    load_rules_from_directory,
    RuleBasedToolGuardian,
)
from wisecore.security.tool_guard.models import GuardSeverity, GuardThreatCategory


class TestGuardRule:
    """Tests for GuardRule class."""

    def test_create_rule_with_required_fields(self):
        """Test creating a rule with required fields."""
        rule = GuardRule({
            "id": "TEST_RULE_001",
            "category": "command_injection",
            "severity": "HIGH",
            "patterns": ["rm -rf"],
        })

        assert rule.id == "TEST_RULE_001"
        assert rule.category == GuardThreatCategory.COMMAND_INJECTION
        assert rule.severity == GuardSeverity.HIGH
        assert "rm -rf" in rule.patterns

    def test_rule_with_tool_constraint(self):
        """Test rule with tool constraint."""
        rule = GuardRule({
            "id": "RULE_001",
            "category": "command_injection",
            "severity": "HIGH",
            "tool": "execute_shell_command",
            "patterns": ["dangerous"],
        })

        assert rule.tools == ["execute_shell_command"]
        assert rule.applies_to_tool("execute_shell_command") is True
        assert rule.applies_to_tool("other_tool") is False

    def test_rule_with_multiple_tools(self):
        """Test rule with multiple tools."""
        rule = GuardRule({
            "id": "RULE_001",
            "category": "command_injection",
            "severity": "HIGH",
            "tools": ["execute_shell_command", "read_file"],
            "patterns": ["test"],
        })

        assert len(rule.tools) == 2
        assert rule.applies_to_tool("execute_shell_command") is True
        assert rule.applies_to_tool("read_file") is True

    def test_rule_applies_to_all_tools_when_empty(self):
        """Test rule applies to all tools when tools list is empty."""
        rule = GuardRule({
            "id": "RULE_001",
            "category": "command_injection",
            "severity": "HIGH",
            "patterns": ["test"],
        })

        assert rule.tools == []
        assert rule.applies_to_tool("any_tool") is True

    def test_rule_with_param_constraint(self):
        """Test rule with param constraint."""
        rule = GuardRule({
            "id": "RULE_001",
            "category": "command_injection",
            "severity": "HIGH",
            "params": ["command"],
            "patterns": ["dangerous"],
        })

        assert rule.params == ["command"]
        assert rule.applies_to_param("command") is True
        assert rule.applies_to_param("other_param") is False

    def test_rule_match_returns_match(self):
        """Test rule match returns match object."""
        rule = GuardRule({
            "id": "RULE_001",
            "category": "command_injection",
            "severity": "HIGH",
            "patterns": ["dangerous"],
        })

        match, pattern = rule.match("This is dangerous content")

        assert match is not None
        assert pattern == "dangerous"

    def test_rule_match_returns_none_for_no_match(self):
        """Test rule match returns None for no match."""
        rule = GuardRule({
            "id": "RULE_001",
            "category": "command_injection",
            "severity": "HIGH",
            "patterns": ["dangerous"],
        })

        match, pattern = rule.match("This is safe content")

        assert match is None
        assert pattern is None

    def test_rule_exclude_pattern_skips_match(self):
        """Test that exclude pattern skips matching."""
        rule = GuardRule({
            "id": "RULE_001",
            "category": "command_injection",
            "severity": "HIGH",
            "patterns": ["dangerous"],
            "exclude_patterns": ["# dangerous"],
        })

        # Should match normally
        match, _ = rule.match("This is dangerous")
        assert match is not None

        # Should not match due to exclude pattern
        match, _ = rule.match("# dangerous comment")
        assert match is None

    def test_rule_case_insensitive_match(self):
        """Test that patterns are case-insensitive."""
        rule = GuardRule({
            "id": "RULE_001",
            "category": "command_injection",
            "severity": "HIGH",
            "patterns": ["DANGEROUS"],
        })

        match, _ = rule.match("this is dangerous")
        assert match is not None

    def test_rule_with_description_and_remediation(self):
        """Test rule with description and remediation."""
        rule = GuardRule({
            "id": "RULE_001",
            "category": "command_injection",
            "severity": "HIGH",
            "patterns": ["test"],
            "description": "A dangerous pattern",
            "remediation": "Avoid this pattern",
        })

        assert rule.description == "A dangerous pattern"
        assert rule.remediation == "Avoid this pattern"

    def test_rule_handles_invalid_regex(self):
        """Test that invalid regex is handled gracefully."""
        # Should not raise, just log warning
        rule = GuardRule({
            "id": "RULE_001",
            "category": "command_injection",
            "severity": "HIGH",
            "patterns": ["[invalid regex"],
        })

        # Pattern should not be compiled
        assert len(rule.compiled_patterns) == 0


class TestLoadRulesFromYaml:
    """Tests for load_rules_from_yaml function."""

    def test_load_valid_yaml(self, temp_dir: Path):
        """Test loading valid YAML file."""
        yaml_content = """
- id: RULE_001
  category: command_injection
  severity: HIGH
  patterns:
    - "rm -rf"
"""
        yaml_file = temp_dir / "rules.yaml"
        yaml_file.write_text(yaml_content)

        rules = load_rules_from_yaml(yaml_file)

        assert len(rules) == 1
        assert rules[0].id == "RULE_001"

    def test_load_empty_yaml(self, temp_dir: Path):
        """Test loading empty YAML file."""
        yaml_file = temp_dir / "empty.yaml"
        yaml_file.write_text("")

        rules = load_rules_from_yaml(yaml_file)

        assert rules == []

    def test_load_yaml_with_invalid_rule(self, temp_dir: Path):
        """Test loading YAML with invalid rule."""
        yaml_content = """
- id: RULE_001
  category: invalid_category
  severity: HIGH
  patterns:
    - "test"
"""
        yaml_file = temp_dir / "invalid.yaml"
        yaml_file.write_text(yaml_content)

        # Should not raise, returns empty list
        rules = load_rules_from_yaml(yaml_file)

        assert rules == []

    def test_load_nonexistent_file(self):
        """Test loading nonexistent file."""
        rules = load_rules_from_yaml(Path("/nonexistent/rules.yaml"))

        assert rules == []


class TestLoadRulesFromDirectory:
    """Tests for load_rules_from_directory function."""

    def test_load_from_nonexistent_directory(self):
        """Test loading from nonexistent directory."""
        rules = load_rules_from_directory(Path("/nonexistent/dir"))

        assert rules == []

    def test_load_specific_files(self, temp_dir: Path):
        """Test loading specific files from directory."""
        yaml_content = """
- id: RULE_001
  category: command_injection
  severity: HIGH
  patterns:
    - "test"
"""
        (temp_dir / "rules.yaml").write_text(yaml_content)

        rules = load_rules_from_directory(temp_dir, rule_files=["rules.yaml"])

        assert len(rules) == 1


class TestRuleBasedToolGuardian:
    """Tests for RuleBasedToolGuardian class."""

    def test_initialization(self):
        """Test guardian initialization."""
        guardian = RuleBasedToolGuardian()

        assert guardian.name == "rule_based_tool_guardian"
        assert isinstance(guardian.rules, list)

    def test_guard_with_no_rules(self):
        """Test guard with no rules returns empty findings."""
        guardian = RuleBasedToolGuardian(extra_rules=[])

        # Clear any loaded rules
        guardian._rules = []

        result = guardian.guard("some_tool", {"param": "value"})

        assert result == []

    def test_guard_with_matching_rule(self):
        """Test guard with matching rule."""
        rule = GuardRule({
            "id": "RULE_001",
            "category": "command_injection",
            "severity": "HIGH",
            "patterns": ["dangerous"],
        })

        guardian = RuleBasedToolGuardian(extra_rules=[rule])

        result = guardian.guard(
            "execute_shell_command",
            {"command": "This is dangerous content"},
        )

        assert len(result) == 1
        assert result[0].rule_id == "RULE_001"
        assert result[0].severity == GuardSeverity.HIGH

    def test_guard_with_tool_constraint(self):
        """Test guard respects tool constraint."""
        rule = GuardRule({
            "id": "RULE_001",
            "category": "command_injection",
            "severity": "HIGH",
            "tool": "execute_shell_command",
            "patterns": ["dangerous"],
        })

        guardian = RuleBasedToolGuardian(extra_rules=[rule])

        # Should match for correct tool
        result = guardian.guard(
            "execute_shell_command",
            {"command": "dangerous"},
        )
        assert len(result) == 1

        # Should not match for different tool
        result = guardian.guard(
            "read_file",
            {"content": "dangerous"},
        )
        assert len(result) == 0

    def test_guard_with_param_constraint(self):
        """Test guard respects param constraint."""
        rule = GuardRule({
            "id": "RULE_001",
            "category": "command_injection",
            "severity": "HIGH",
            "params": ["command"],
            "patterns": ["dangerous"],
        })

        guardian = RuleBasedToolGuardian(extra_rules=[rule])

        result = guardian.guard(
            "some_tool",
            {"command": "dangerous", "other": "safe"},
        )

        # Only 'command' param should be scanned
        assert len(result) == 1

    def test_guard_with_none_value(self):
        """Test guard handles None parameter values."""
        rule = GuardRule({
            "id": "RULE_001",
            "category": "command_injection",
            "severity": "HIGH",
            "patterns": ["dangerous"],
        })

        guardian = RuleBasedToolGuardian(extra_rules=[rule])

        result = guardian.guard("some_tool", {"param": None})

        assert result == []

    def test_guard_with_empty_value(self):
        """Test guard handles empty string values."""
        rule = GuardRule({
            "id": "RULE_001",
            "category": "command_injection",
            "severity": "HIGH",
            "patterns": ["dangerous"],
        })

        guardian = RuleBasedToolGuardian(extra_rules=[rule])

        result = guardian.guard("some_tool", {"param": ""})

        assert result == []

    def test_reload(self):
        """Test reload method."""
        guardian = RuleBasedToolGuardian()

        # Should not raise
        guardian.reload()

    def test_rule_count_property(self):
        """Test rule_count property."""
        rule = GuardRule({
            "id": "RULE_001",
            "category": "command_injection",
            "severity": "HIGH",
            "patterns": ["test"],
        })

        guardian = RuleBasedToolGuardian(extra_rules=[rule])

        assert guardian.rule_count >= 1

    def test_finding_has_correct_metadata(self):
        """Test that finding has correct metadata."""
        rule = GuardRule({
            "id": "RULE_001",
            "category": "command_injection",
            "severity": "CRITICAL",
            "patterns": ["dangerous"],
            "description": "Dangerous pattern detected",
            "remediation": "Avoid this pattern",
        })

        guardian = RuleBasedToolGuardian(extra_rules=[rule])

        result = guardian.guard(
            "execute_shell_command",
            {"command": "dangerous content"},
        )

        assert len(result) == 1
        finding = result[0]
        assert finding.tool_name == "execute_shell_command"
        assert finding.param_name == "command"
        assert finding.guardian == "rule_based_tool_guardian"
        assert finding.remediation == "Avoid this pattern"
