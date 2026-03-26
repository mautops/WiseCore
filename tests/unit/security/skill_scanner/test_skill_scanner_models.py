# -*- coding: utf-8 -*-
"""Unit tests for skill scanner models."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

from wisecore.security.skill_scanner.models import (
    Severity,
    ThreatCategory,
    SkillFile,
    Finding,
    ScanResult,
)


class TestSeverity:
    """Tests for Severity enum."""

    def test_severity_values(self):
        """Test that severity enum has expected values."""
        assert Severity.CRITICAL.value == "CRITICAL"
        assert Severity.HIGH.value == "HIGH"
        assert Severity.MEDIUM.value == "MEDIUM"
        assert Severity.LOW.value == "LOW"
        assert Severity.INFO.value == "INFO"
        assert Severity.SAFE.value == "SAFE"

    def test_severity_is_string_enum(self):
        """Test that severity is a string enum."""
        assert Severity.CRITICAL == "CRITICAL"
        assert Severity.HIGH == "HIGH"


class TestThreatCategory:
    """Tests for ThreatCategory enum."""

    def test_category_values(self):
        """Test that threat categories have expected values."""
        assert ThreatCategory.PROMPT_INJECTION.value == "prompt_injection"
        assert ThreatCategory.COMMAND_INJECTION.value == "command_injection"
        assert ThreatCategory.DATA_EXFILTRATION.value == "data_exfiltration"

    def test_all_categories_exist(self):
        """Test that all expected categories exist."""
        expected = [
            "PROMPT_INJECTION",
            "COMMAND_INJECTION",
            "DATA_EXFILTRATION",
            "UNAUTHORIZED_TOOL_USE",
            "OBFUSCATION",
            "HARDCODED_SECRETS",
            "SOCIAL_ENGINEERING",
            "RESOURCE_ABUSE",
            "POLICY_VIOLATION",
            "MALWARE",
            "HARMFUL_CONTENT",
            "SKILL_DISCOVERY_ABUSE",
            "TRANSITIVE_TRUST_ABUSE",
            "AUTONOMY_ABUSE",
            "TOOL_CHAINING_ABUSE",
            "UNICODE_STEGANOGRAPHY",
            "SUPPLY_CHAIN_ATTACK",
        ]
        for cat in expected:
            assert hasattr(ThreatCategory, cat)


class TestSkillFile:
    """Tests for SkillFile dataclass."""

    def test_create_skill_file(self, temp_dir: Path):
        """Test creating a SkillFile instance."""
        file_path = temp_dir / "test.py"
        file_path.write_text("print('hello')")

        skill_file = SkillFile(
            path=file_path,
            relative_path="test.py",
            file_type="python",
        )

        assert skill_file.path == file_path
        assert skill_file.relative_path == "test.py"
        assert skill_file.file_type == "python"
        assert skill_file.content is None
        assert skill_file.size_bytes == 0

    def test_read_content(self, temp_dir: Path):
        """Test reading file content."""
        file_path = temp_dir / "test.md"
        file_path.write_text("# Test Content\nHello World")

        skill_file = SkillFile(
            path=file_path,
            relative_path="test.md",
            file_type="markdown",
        )

        content = skill_file.read_content()

        assert content == "# Test Content\nHello World"
        assert skill_file.content == content

    def test_read_content_cached(self, temp_dir: Path):
        """Test that read_content caches content."""
        file_path = temp_dir / "test.py"
        file_path.write_text("original")

        skill_file = SkillFile(
            path=file_path,
            relative_path="test.py",
            file_type="python",
            content="cached",
        )

        content = skill_file.read_content()
        assert content == "cached"

    def test_read_content_nonexistent_file(self, temp_dir: Path):
        """Test reading content from nonexistent file."""
        skill_file = SkillFile(
            path=temp_dir / "nonexistent.py",
            relative_path="nonexistent.py",
            file_type="python",
        )

        content = skill_file.read_content()
        assert content == ""

    def test_is_hidden_dotfile(self):
        """Test is_hidden for dotfiles."""
        skill_file = SkillFile(
            path=Path("/tmp/.env"),
            relative_path=".env",
            file_type="other",
        )

        assert skill_file.is_hidden is True

    def test_is_hidden_in_hidden_dir(self):
        """Test is_hidden for files in hidden directories."""
        skill_file = SkillFile(
            path=Path("/tmp/.git/config"),
            relative_path=".git/config",
            file_type="other",
        )

        assert skill_file.is_hidden is True

    def test_is_not_hidden(self):
        """Test is_hidden returns False for normal files."""
        skill_file = SkillFile(
            path=Path("/tmp/src/main.py"),
            relative_path="src/main.py",
            file_type="python",
        )

        assert skill_file.is_hidden is False

    def test_from_path(self, temp_dir: Path):
        """Test creating SkillFile from path."""
        base_dir = temp_dir
        file_path = temp_dir / "scripts" / "main.py"
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text("# script")

        skill_file = SkillFile.from_path(file_path, base_dir)

        assert skill_file.path == file_path
        assert skill_file.relative_path == "scripts/main.py"
        assert skill_file.file_type == "python"
        assert skill_file.size_bytes > 0

    def test_file_type_mapping(self, temp_dir: Path):
        """Test file type detection from extension."""
        test_cases = [
            ("test.md", "markdown"),
            ("test.py", "python"),
            ("test.sh", "bash"),
            ("test.js", "javascript"),
            ("test.ts", "typescript"),
            ("test.yaml", "yaml"),
            ("test.json", "json"),
            ("test.toml", "toml"),
            ("test.unknown", "other"),
        ]

        for filename, expected_type in test_cases:
            file_path = temp_dir / filename
            file_path.touch()

            skill_file = SkillFile.from_path(file_path, temp_dir)
            assert skill_file.file_type == expected_type, f"Failed for {filename}"


class TestFinding:
    """Tests for Finding dataclass."""

    def test_create_finding(self):
        """Test creating a security finding."""
        finding = Finding(
            id="scan-001",
            rule_id="RULE_PROMPT_INJECTION",
            category=ThreatCategory.PROMPT_INJECTION,
            severity=Severity.HIGH,
            title="Prompt Injection Detected",
            description="Potential prompt injection in skill file",
            file_path="skills/test/skill.md",
            line_number=42,
            snippet="Ignore previous instructions",
        )

        assert finding.id == "scan-001"
        assert finding.rule_id == "RULE_PROMPT_INJECTION"
        assert finding.category == ThreatCategory.PROMPT_INJECTION
        assert finding.severity == Severity.HIGH
        assert finding.title == "Prompt Injection Detected"
        assert finding.file_path == "skills/test/skill.md"
        assert finding.line_number == 42
        assert finding.snippet == "Ignore previous instructions"

    def test_finding_to_dict(self):
        """Test converting finding to dictionary."""
        finding = Finding(
            id="f1",
            rule_id="R1",
            category=ThreatCategory.COMMAND_INJECTION,
            severity=Severity.CRITICAL,
            title="Command Injection",
            description="OS command injection vulnerability",
            file_path="script.sh",
            line_number=10,
            metadata={"confidence": 0.95},
        )

        result = finding.to_dict()

        assert result["id"] == "f1"
        assert result["rule_id"] == "R1"
        assert result["category"] == "command_injection"
        assert result["severity"] == "CRITICAL"
        assert result["file_path"] == "script.sh"
        assert result["line_number"] == 10
        assert result["metadata"]["confidence"] == 0.95

    def test_finding_with_remediation(self):
        """Test finding with remediation advice."""
        finding = Finding(
            id="f1",
            rule_id="R1",
            category=ThreatCategory.HARDCODED_SECRETS,
            severity=Severity.HIGH,
            title="Hardcoded Secret",
            description="API key found in code",
            remediation="Use environment variables for secrets",
        )

        assert finding.remediation == "Use environment variables for secrets"


class TestScanResult:
    """Tests for ScanResult dataclass."""

    def test_create_empty_result(self):
        """Test creating an empty scan result."""
        result = ScanResult(
            skill_name="test-skill",
            skill_directory="/skills/test-skill",
        )

        assert result.skill_name == "test-skill"
        assert result.skill_directory == "/skills/test-skill"
        assert result.findings == []
        assert result.is_safe is True
        assert result.max_severity == Severity.SAFE
        assert len(result.findings) == 0

    def test_result_with_findings(self):
        """Test result with security findings."""
        findings = [
            Finding(
                id=f"f{i}",
                rule_id=f"R{i}",
                category=ThreatCategory.PROMPT_INJECTION,
                severity=sev,
                title=f"Finding {i}",
                description="desc",
            )
            for i, sev in enumerate([Severity.HIGH, Severity.LOW])
        ]

        result = ScanResult(
            skill_name="risky-skill",
            skill_directory="/skills/risky",
            findings=findings,
        )

        assert len(result.findings) == 2
        assert result.is_safe is False  # HIGH severity present

    def test_is_safe_with_only_low_severity(self):
        """Test is_safe returns True with only low severity findings."""
        finding = Finding(
            id="f1",
            rule_id="R1",
            category=ThreatCategory.POLICY_VIOLATION,
            severity=Severity.LOW,
            title="Minor Policy Violation",
            description="desc",
        )

        result = ScanResult(
            skill_name="test",
            skill_directory="/test",
            findings=[finding],
        )

        assert result.is_safe is True
        assert result.max_severity == Severity.LOW

    def test_is_safe_with_critical_severity(self):
        """Test is_safe returns False with critical severity."""
        finding = Finding(
            id="f1",
            rule_id="R1",
            category=ThreatCategory.MALWARE,
            severity=Severity.CRITICAL,
            title="Malware Detected",
            description="desc",
        )

        result = ScanResult(
            skill_name="malicious",
            skill_directory="/malicious",
            findings=[finding],
        )

        assert result.is_safe is False
        assert result.max_severity == Severity.CRITICAL

    def test_get_findings_by_severity(self):
        """Test filtering findings by severity."""
        findings = [
            Finding(
                id=f"f{i}",
                rule_id=f"R{i}",
                category=ThreatCategory.COMMAND_INJECTION,
                severity=sev,
                title=f"Finding {i}",
                description="desc",
            )
            for i, sev in enumerate(
                [Severity.HIGH, Severity.LOW, Severity.HIGH, Severity.INFO],
            )
        ]

        result = ScanResult(
            skill_name="test",
            skill_directory="/test",
            findings=findings,
        )

        high_findings = result.get_findings_by_severity(Severity.HIGH)
        assert len(high_findings) == 2

        info_findings = result.get_findings_by_severity(Severity.INFO)
        assert len(info_findings) == 1

    def test_get_findings_by_category(self):
        """Test filtering findings by category."""
        findings = [
            Finding(
                id="f1",
                rule_id="R1",
                category=ThreatCategory.PROMPT_INJECTION,
                severity=Severity.HIGH,
                title="Prompt Injection",
                description="desc",
            ),
            Finding(
                id="f2",
                rule_id="R2",
                category=ThreatCategory.COMMAND_INJECTION,
                severity=Severity.MEDIUM,
                title="Command Injection",
                description="desc",
            ),
        ]

        result = ScanResult(
            skill_name="test",
            skill_directory="/test",
            findings=findings,
        )

        prompt_findings = result.get_findings_by_category(ThreatCategory.PROMPT_INJECTION)
        assert len(prompt_findings) == 1
        assert prompt_findings[0].title == "Prompt Injection"

    def test_result_to_dict(self):
        """Test converting result to dictionary."""
        finding = Finding(
            id="f1",
            rule_id="R1",
            category=ThreatCategory.PROMPT_INJECTION,
            severity=Severity.HIGH,
            title="Test Finding",
            description="desc",
        )

        result = ScanResult(
            skill_name="test-skill",
            skill_directory="/skills/test",
            findings=[finding],
            scan_duration_seconds=0.15,
            analyzers_used=["pattern_analyzer"],
        )

        d = result.to_dict()

        assert d["skill_name"] == "test-skill"
        assert d["skill_path"] == "/skills/test"
        assert d["is_safe"] is False
        assert d["max_severity"] == "HIGH"
        assert d["findings_count"] == 1
        assert d["scan_duration_seconds"] == 0.15
        assert d["analyzers_used"] == ["pattern_analyzer"]
        assert "timestamp" in d

    def test_result_with_analyzers_failed(self):
        """Test result with failed analyzers."""
        result = ScanResult(
            skill_name="test",
            skill_directory="/test",
            analyzers_failed=[{"name": "broken_analyzer", "error": "Test error"}],
        )

        d = result.to_dict()

        assert "analyzers_failed" in d
        assert d["analyzers_failed"][0]["name"] == "broken_analyzer"

    def test_max_severity_ordering(self):
        """Test that max_severity returns highest severity."""
        findings = [
            Finding(
                id=f"f{i}",
                rule_id=f"R{i}",
                category=ThreatCategory.COMMAND_INJECTION,
                severity=sev,
                title=f"Finding {i}",
                description="desc",
            )
            for i, sev in enumerate(
                [Severity.INFO, Severity.MEDIUM, Severity.LOW],
            )
        ]

        result = ScanResult(
            skill_name="test",
            skill_directory="/test",
            findings=findings,
        )

        # MEDIUM is highest in this list
        assert result.max_severity == Severity.MEDIUM
