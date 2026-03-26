# -*- coding: utf-8 -*-
"""Unit tests for tool guard models."""

from __future__ import annotations

import pytest

from wisecore.security.tool_guard.models import (
    GuardFinding,
    GuardSeverity,
    GuardThreatCategory,
    ToolGuardResult,
    TOOL_GUARD_DENIED_MARK,
)


class TestGuardSeverity:
    """Tests for GuardSeverity enum."""

    def test_severity_values(self):
        """Test that severity enum has expected values."""
        assert GuardSeverity.CRITICAL.value == "CRITICAL"
        assert GuardSeverity.HIGH.value == "HIGH"
        assert GuardSeverity.MEDIUM.value == "MEDIUM"
        assert GuardSeverity.LOW.value == "LOW"
        assert GuardSeverity.INFO.value == "INFO"
        assert GuardSeverity.SAFE.value == "SAFE"

    def test_severity_is_string_enum(self):
        """Test that severity is a string enum."""
        assert GuardSeverity.CRITICAL == "CRITICAL"
        assert GuardSeverity.HIGH == "HIGH"


class TestGuardThreatCategory:
    """Tests for GuardThreatCategory enum."""

    def test_category_values(self):
        """Test that threat categories have expected values."""
        assert GuardThreatCategory.COMMAND_INJECTION.value == "command_injection"
        assert GuardThreatCategory.PATH_TRAVERSAL.value == "path_traversal"
        assert GuardThreatCategory.SENSITIVE_FILE_ACCESS.value == "sensitive_file_access"

    def test_all_categories_exist(self):
        """Test that all expected categories exist."""
        expected = [
            "COMMAND_INJECTION",
            "DATA_EXFILTRATION",
            "PATH_TRAVERSAL",
            "SENSITIVE_FILE_ACCESS",
            "NETWORK_ABUSE",
            "CREDENTIAL_EXPOSURE",
            "RESOURCE_ABUSE",
            "PROMPT_INJECTION",
            "CODE_EXECUTION",
            "PRIVILEGE_ESCALATION",
        ]
        for cat in expected:
            assert hasattr(GuardThreatCategory, cat)


class TestGuardFinding:
    """Tests for GuardFinding dataclass."""

    def test_create_finding(self):
        """Test creating a guard finding."""
        finding = GuardFinding(
            id="test-001",
            rule_id="RULE_001",
            category=GuardThreatCategory.COMMAND_INJECTION,
            severity=GuardSeverity.HIGH,
            title="Test Finding",
            description="A test security finding",
            tool_name="execute_shell_command",
        )

        assert finding.id == "test-001"
        assert finding.rule_id == "RULE_001"
        assert finding.category == GuardThreatCategory.COMMAND_INJECTION
        assert finding.severity == GuardSeverity.HIGH
        assert finding.title == "Test Finding"
        assert finding.description == "A test security finding"
        assert finding.tool_name == "execute_shell_command"
        assert finding.param_name is None
        assert finding.matched_value is None
        assert finding.metadata == {}

    def test_finding_to_dict(self):
        """Test converting finding to dictionary."""
        finding = GuardFinding(
            id="test-002",
            rule_id="RULE_002",
            category=GuardThreatCategory.PATH_TRAVERSAL,
            severity=GuardSeverity.CRITICAL,
            title="Path Traversal",
            description="Attempted path traversal",
            tool_name="read_file",
            param_name="file_path",
            matched_value="../../../etc/passwd",
        )

        result = finding.to_dict()

        assert result["id"] == "test-002"
        assert result["rule_id"] == "RULE_002"
        assert result["category"] == "path_traversal"
        assert result["severity"] == "CRITICAL"
        assert result["tool_name"] == "read_file"
        assert result["param_name"] == "file_path"
        assert result["matched_value"] == "../../../etc/passwd"

    def test_finding_with_metadata(self):
        """Test finding with metadata."""
        finding = GuardFinding(
            id="test-003",
            rule_id="RULE_003",
            category=GuardThreatCategory.SENSITIVE_FILE_ACCESS,
            severity=GuardSeverity.MEDIUM,
            title="Sensitive Access",
            description="Access to sensitive file",
            tool_name="read_file",
            metadata={"pattern": "*.pem", "confidence": 0.9},
        )

        assert finding.metadata["pattern"] == "*.pem"
        assert finding.metadata["confidence"] == 0.9


class TestToolGuardResult:
    """Tests for ToolGuardResult dataclass."""

    def test_create_empty_result(self):
        """Test creating an empty guard result."""
        result = ToolGuardResult(
            tool_name="read_file",
            params={"file_path": "/tmp/test.txt"},
        )

        assert result.tool_name == "read_file"
        assert result.params == {"file_path": "/tmp/test.txt"}
        assert result.findings == []
        assert result.is_safe is True
        assert result.max_severity == GuardSeverity.SAFE
        assert result.findings_count == 0

    def test_result_with_findings(self):
        """Test result with security findings."""
        finding1 = GuardFinding(
            id="f1",
            rule_id="R1",
            category=GuardThreatCategory.COMMAND_INJECTION,
            severity=GuardSeverity.HIGH,
            title="High Risk",
            description="High risk finding",
            tool_name="execute_shell_command",
        )
        finding2 = GuardFinding(
            id="f2",
            rule_id="R2",
            category=GuardThreatCategory.PATH_TRAVERSAL,
            severity=GuardSeverity.LOW,
            title="Low Risk",
            description="Low risk finding",
            tool_name="read_file",
        )

        result = ToolGuardResult(
            tool_name="execute_shell_command",
            params={"command": "ls"},
            findings=[finding1, finding2],
        )

        assert result.findings_count == 2
        assert result.is_safe is False  # HIGH severity present
        assert result.max_severity == GuardSeverity.HIGH

    def test_is_safe_with_only_low_severity(self):
        """Test is_safe returns True with only low severity findings."""
        finding = GuardFinding(
            id="f1",
            rule_id="R1",
            category=GuardThreatCategory.PATH_TRAVERSAL,
            severity=GuardSeverity.LOW,
            title="Low Risk",
            description="Low risk finding",
            tool_name="read_file",
        )

        result = ToolGuardResult(
            tool_name="read_file",
            params={},
            findings=[finding],
        )

        assert result.is_safe is True
        assert result.max_severity == GuardSeverity.LOW

    def test_is_safe_with_critical_severity(self):
        """Test is_safe returns False with critical severity."""
        finding = GuardFinding(
            id="f1",
            rule_id="R1",
            category=GuardThreatCategory.COMMAND_INJECTION,
            severity=GuardSeverity.CRITICAL,
            title="Critical",
            description="Critical finding",
            tool_name="execute_shell_command",
        )

        result = ToolGuardResult(
            tool_name="execute_shell_command",
            params={},
            findings=[finding],
        )

        assert result.is_safe is False
        assert result.max_severity == GuardSeverity.CRITICAL

    def test_get_findings_by_severity(self):
        """Test filtering findings by severity."""
        findings = [
            GuardFinding(
                id=f"f{i}",
                rule_id=f"R{i}",
                category=GuardThreatCategory.COMMAND_INJECTION,
                severity=sev,
                title=f"Finding {i}",
                description="desc",
                tool_name="test",
            )
            for i, sev in enumerate(
                [GuardSeverity.HIGH, GuardSeverity.LOW, GuardSeverity.HIGH],
            )
        ]

        result = ToolGuardResult(
            tool_name="test",
            params={},
            findings=findings,
        )

        high_findings = result.get_findings_by_severity(GuardSeverity.HIGH)
        assert len(high_findings) == 2

        low_findings = result.get_findings_by_severity(GuardSeverity.LOW)
        assert len(low_findings) == 1

    def test_get_findings_by_category(self):
        """Test filtering findings by category."""
        findings = [
            GuardFinding(
                id="f1",
                rule_id="R1",
                category=GuardThreatCategory.COMMAND_INJECTION,
                severity=GuardSeverity.HIGH,
                title="Cmd Injection",
                description="desc",
                tool_name="test",
            ),
            GuardFinding(
                id="f2",
                rule_id="R2",
                category=GuardThreatCategory.PATH_TRAVERSAL,
                severity=GuardSeverity.LOW,
                title="Path Traversal",
                description="desc",
                tool_name="test",
            ),
        ]

        result = ToolGuardResult(
            tool_name="test",
            params={},
            findings=findings,
        )

        cmd_findings = result.get_findings_by_category(GuardThreatCategory.COMMAND_INJECTION)
        assert len(cmd_findings) == 1
        assert cmd_findings[0].title == "Cmd Injection"

    def test_result_to_dict(self):
        """Test converting result to dictionary."""
        finding = GuardFinding(
            id="f1",
            rule_id="R1",
            category=GuardThreatCategory.COMMAND_INJECTION,
            severity=GuardSeverity.HIGH,
            title="Test",
            description="desc",
            tool_name="test_tool",
        )

        result = ToolGuardResult(
            tool_name="test_tool",
            params={"arg1": "value1"},
            findings=[finding],
            guard_duration_seconds=0.05,
            guardians_used=["rule_guardian"],
        )

        d = result.to_dict()

        assert d["tool_name"] == "test_tool"
        assert d["is_safe"] is False
        assert d["max_severity"] == "HIGH"
        assert d["findings_count"] == 1
        assert d["guard_duration_seconds"] == 0.05
        assert d["guardians_used"] == ["rule_guardian"]
        assert "timestamp" in d

    def test_result_with_guardians_failed(self):
        """Test result with failed guardians."""
        result = ToolGuardResult(
            tool_name="test",
            params={},
            guardians_failed=[{"name": "broken_guardian", "error": "Test error"}],
        )

        d = result.to_dict()

        assert "guardians_failed" in d
        assert d["guardians_failed"][0]["name"] == "broken_guardian"

    def test_tool_guard_denied_mark(self):
        """Test the tool guard denied mark constant."""
        assert TOOL_GUARD_DENIED_MARK == "tool_guard_denied"

    def test_max_severity_ordering(self):
        """Test that max_severity returns highest severity."""
        findings = [
            GuardFinding(
                id=f"f{i}",
                rule_id=f"R{i}",
                category=GuardThreatCategory.COMMAND_INJECTION,
                severity=sev,
                title=f"Finding {i}",
                description="desc",
                tool_name="test",
            )
            for i, sev in enumerate(
                [GuardSeverity.LOW, GuardSeverity.MEDIUM, GuardSeverity.INFO],
            )
        ]

        result = ToolGuardResult(
            tool_name="test",
            params={},
            findings=findings,
        )

        # MEDIUM is highest in this list
        assert result.max_severity == GuardSeverity.MEDIUM
