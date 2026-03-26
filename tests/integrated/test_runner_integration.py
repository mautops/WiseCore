# -*- coding: utf-8 -*-
"""Integration tests for runner and session management."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestChatSessionIntegration:
    """Integration tests for chat session management."""

    @pytest.mark.integration
    def test_chat_spec_creation_and_persistence(self, integration_temp_dir: Path):
        """Test chat spec creation and persistence."""
        from wisecore.app.runner.models import ChatSpec, ChatsFile
        import json

        # Create chat specs
        chats = [
            ChatSpec(
                session_id="console:user1",
                user_id="user1",
                name="First Chat",
            ),
            ChatSpec(
                session_id="console:user2",
                user_id="user2",
                name="Second Chat",
            ),
        ]

        # Create chats file
        chats_file = ChatsFile(chats=chats)

        # Save to disk
        file_path = integration_temp_dir / "chats.json"
        file_path.write_text(chats_file.model_dump_json(indent=2))

        # Load and verify
        loaded = ChatsFile.model_validate_json(file_path.read_text())
        assert len(loaded.chats) == 2
        assert loaded.chats[0].name == "First Chat"
        assert loaded.chats[1].session_id == "console:user2"

    @pytest.mark.integration
    def test_chat_status_tracking(self):
        """Test chat status tracking."""
        from wisecore.app.runner.models import ChatSpec

        chat = ChatSpec(
            session_id="console:test",
            user_id="test",
            status="idle",
        )

        assert chat.status == "idle"

        # Update status
        chat.status = "running"
        assert chat.status == "running"


class TestCronJobIntegration:
    """Integration tests for cron job management."""

    @pytest.mark.integration
    def test_cron_job_creation_and_validation(self):
        """Test cron job creation and validation."""
        from wisecore.app.crons.models import (
            CronJobSpec,
            ScheduleSpec,
            DispatchSpec,
            DispatchTarget,
        )

        schedule = ScheduleSpec(cron="0 9 * * mon")  # Every Monday at 9am
        target = DispatchTarget(user_id="user1", session_id="console:user1")
        dispatch = DispatchSpec(target=target)

        job = CronJobSpec(
            id="weekly-report",
            name="Weekly Report",
            schedule=schedule,
            task_type="text",
            text="Generate weekly report",
            dispatch=dispatch,
        )

        assert job.enabled is True
        assert job.schedule.cron == "0 9 * * mon"

    @pytest.mark.integration
    def test_cron_job_persistence(self, integration_temp_dir: Path):
        """Test cron job persistence to file."""
        from wisecore.app.crons.models import (
            CronJobSpec,
            ScheduleSpec,
            DispatchSpec,
            DispatchTarget,
            JobsFile,
        )

        schedule = ScheduleSpec(cron="0 9 * * *")
        target = DispatchTarget(user_id="user", session_id="console:user")
        dispatch = DispatchSpec(target=target)

        job = CronJobSpec(
            id="daily-task",
            name="Daily Task",
            schedule=schedule,
            task_type="text",
            text="Good morning!",
            dispatch=dispatch,
        )

        jobs_file = JobsFile(jobs=[job])

        # Save to disk
        file_path = integration_temp_dir / "jobs.json"
        file_path.write_text(jobs_file.model_dump_json(indent=2))

        # Load and verify
        loaded = JobsFile.model_validate_json(file_path.read_text())
        assert len(loaded.jobs) == 1
        assert loaded.jobs[0].id == "daily-task"

    @pytest.mark.integration
    def test_cron_schedule_normalization(self):
        """Test cron schedule normalization."""
        from wisecore.app.crons.models import ScheduleSpec

        # Test 5-field cron stays normalized
        schedule = ScheduleSpec(cron="0 9 * * 1")
        assert "mon" in schedule.cron  # 1 should be converted to 'mon'

        # Test 4-field cron gets normalized
        schedule = ScheduleSpec(cron="9 * * mon")
        assert schedule.cron.startswith("0 9")

        # Test 3-field cron gets normalized
        schedule = ScheduleSpec(cron="* * mon")
        assert schedule.cron.startswith("0 0")


class TestChannelIntegration:
    """Integration tests for channel system."""

    @pytest.mark.integration
    def test_channel_address_routing(self):
        """Test channel address routing."""
        from wisecore.app.channels.schema import ChannelAddress

        # DM address
        dm_addr = ChannelAddress(kind="dm", id="user123")
        assert dm_addr.to_handle() == "dm:user123"

        # Channel address with extra
        ch_addr = ChannelAddress(
            kind="channel",
            id="general",
            extra={"to_handle": "discord:ch:123"},
        )
        assert ch_addr.to_handle() == "discord:ch:123"

    @pytest.mark.integration
    def test_message_splitting(self):
        """Test message splitting for channel limits."""
        from wisecore.app.channels.utils import split_text

        # Long message
        long_text = "Line 1\n" * 5000

        chunks = split_text(long_text, max_len=1000)

        # Should be split into multiple chunks
        assert len(chunks) > 1

        # Each chunk should respect max_len
        for chunk in chunks:
            assert len(chunk) <= 1000

    @pytest.mark.integration
    def test_file_url_conversion(self):
        """Test file URL to local path conversion."""
        from wisecore.app.channels.utils import file_url_to_local_path

        # file:// URL
        assert file_url_to_local_path("file:///tmp/test.txt") is not None

        # HTTP URL should return None
        assert file_url_to_local_path("http://example.com/file.txt") is None

        # Local path should pass through
        assert file_url_to_local_path("/tmp/test.txt") == "/tmp/test.txt"


class TestWorkspaceIntegration:
    """Integration tests for workspace management."""

    @pytest.mark.integration
    def test_workspace_context_management(self):
        """Test workspace context variable management."""
        from wisecore.config.context import (
            get_current_workspace_dir,
            set_current_workspace_dir,
        )
        from pathlib import Path

        # Initially None
        set_current_workspace_dir(None)
        assert get_current_workspace_dir() is None

        # Set workspace
        test_path = Path("/tmp/test_workspace")
        set_current_workspace_dir(test_path)
        assert get_current_workspace_dir() == test_path

        # Clear
        set_current_workspace_dir(None)
        assert get_current_workspace_dir() is None
