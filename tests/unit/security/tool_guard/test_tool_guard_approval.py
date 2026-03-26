# -*- coding: utf-8 -*-
"""Unit tests for tool guard approval helpers."""

from __future__ import annotations

import pytest

from wisecore.security.tool_guard.approval import ApprovalDecision, format_findings_summary
from wisecore.security.tool_guard.models import (
    GuardFinding,
    GuardSeverity,
    GuardThreatCategory,
    ToolGuardResult,
)


class TestApprovalDecision:
    """Tests for ApprovalDecision enum."""

    def test_decision_values(self):
        """Test that approval decision enum has expected values."""
        assert ApprovalDecision.APPROVED.value == "approved"
        assert ApprovalDecision.DENIED.value == "denied"
        assert ApprovalDecision.TIMEOUT.value == "timeout"

    def test_decision_is_string_enum(self):
        """Test that decision is a string enum."""
        assert ApprovalDecision.APPROVED == "approved"
        assert ApprovalDecision.DENIED == "denied"


class TestFormatFindingsSummary:
    """Tests for format_findings_summary function."""

    def test_format_empty_findings(self):
        """Test formatting with no findings."""
        result = ToolGuardResult(
            tool_name="safe_tool",
            params={},
            findings=[],
        )

        summary = format_findings_summary(result)

        assert summary == "No specific risk rules matched."

    def test_format_single_finding(self):
        """Test formatting with single finding."""
        finding = GuardFinding(
            id="f1",
            rule_id="R1",
            category=GuardThreatCategory.COMMAND_INJECTION,
            severity=GuardSeverity.HIGH,
            title="Command Injection",
            description="Potential command injection detected",
            tool_name="execute_shell_command",
        )

        result = ToolGuardResult(
            tool_name="execute_shell_command",
            params={"command": "ls"},
            findings=[finding],
        )

        summary = format_findings_summary(result)

        assert "[HIGH]" in summary
        assert "Potential command injection detected" in summary

    def test_format_multiple_findings(self):
        """Test formatting with multiple findings."""
        findings = [
            GuardFinding(
                id=f"f{i}",
                rule_id=f"R{i}",
                category=GuardThreatCategory.COMMAND_INJECTION,
                severity=sev,
                title=f"Finding {i}",
                description=f"Description {i}",
                tool_name="test",
            )
            for i, sev in enumerate([GuardSeverity.HIGH, GuardSeverity.MEDIUM])
        ]

        result = ToolGuardResult(
            tool_name="test",
            params={},
            findings=findings,
        )

        summary = format_findings_summary(result)

        assert "[HIGH]" in summary
        assert "[MEDIUM]" in summary
        assert "Description 0" in summary
        assert "Description 1" in summary

    def test_format_with_max_items(self):
        """Test formatting respects max_items parameter."""
        findings = [
            GuardFinding(
                id=f"f{i}",
                rule_id=f"R{i}",
                category=GuardThreatCategory.COMMAND_INJECTION,
                severity=GuardSeverity.LOW,
                title=f"Finding {i}",
                description=f"Description {i}",
                tool_name="test",
            )
            for i in range(5)
        ]

        result = ToolGuardResult(
            tool_name="test",
            params={},
            findings=findings,
        )

        summary = format_findings_summary(result, max_items=2)

        # Should show only 2 items plus "more" message
        assert "Description 0" in summary
        assert "Description 1" in summary
        assert "and 3 more finding(s) omitted" in summary

    def test_format_exact_max_items(self):
        """Test formatting when findings equal max_items."""
        findings = [
            GuardFinding(
                id="f0",
                rule_id="R0",
                category=GuardThreatCategory.COMMAND_INJECTION,
                severity=GuardSeverity.LOW,
                title="Finding 0",
                description="Description 0",
                tool_name="test",
            ),
            GuardFinding(
                id="f1",
                rule_id="R1",
                category=GuardThreatCategory.COMMAND_INJECTION,
                severity=GuardSeverity.LOW,
                title="Finding 1",
                description="Description 1",
                tool_name="test",
            ),
        ]

        result = ToolGuardResult(
            tool_name="test",
            params={},
            findings=findings,
        )

        summary = format_findings_summary(result, max_items=2)

        # Should show both items without "more" message
        assert "Description 0" in summary
        assert "Description 1" in summary
        assert "more finding" not in summary

    def test_format_critical_severity(self):
        """Test formatting with critical severity."""
        finding = GuardFinding(
            id="f1",
            rule_id="R1",
            category=GuardThreatCategory.PATH_TRAVERSAL,
            severity=GuardSeverity.CRITICAL,
            title="Critical Path Traversal",
            description="Path traversal vulnerability detected",
            tool_name="read_file",
        )

        result = ToolGuardResult(
            tool_name="read_file",
            params={},
            findings=[finding],
        )

        summary = format_findings_summary(result)

        assert "[CRITICAL]" in summary
        assert "Path traversal vulnerability detected" in summary

    def test_format_uses_markdown_list(self):
        """Test that formatting uses markdown list format."""
        finding = GuardFinding(
            id="f1",
            rule_id="R1",
            category=GuardThreatCategory.COMMAND_INJECTION,
            severity=GuardSeverity.HIGH,
            title="Test",
            description="Test description",
            tool_name="test",
        )

        result = ToolGuardResult(
            tool_name="test",
            params={},
            findings=[finding],
        )

        summary = format_findings_summary(result)

        assert summary.startswith("- ")
