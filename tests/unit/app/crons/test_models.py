# -*- coding: utf-8 -*-
"""Unit tests for crons models."""

from __future__ import annotations

import pytest

from wisecore.app.crons.models import (
    ScheduleSpec,
    DispatchTarget,
    DispatchSpec,
    JobRuntimeSpec,
    CronJobRequest,
    CronJobSpec,
    CronJobState,
    CronJobView,
    JobsFile,
    _crontab_dow_to_name,
)


class TestCrontabDowToName:
    """Tests for _crontab_dow_to_name function."""

    def test_star_remains_unchanged(self):
        """Test that * remains unchanged."""
        result = _crontab_dow_to_name("*")
        assert result == "*"

    def test_single_number_converted(self):
        """Test single number conversion."""
        assert _crontab_dow_to_name("0") == "sun"
        assert _crontab_dow_to_name("1") == "mon"
        assert _crontab_dow_to_name("5") == "fri"

    def test_already_named_passed_through(self):
        """Test that named values pass through."""
        assert _crontab_dow_to_name("mon") == "mon"
        assert _crontab_dow_to_name("fri") == "fri"

    def test_comma_separated(self):
        """Test comma-separated values."""
        result = _crontab_dow_to_name("0,1,2")
        assert result == "sun,mon,tue"

    def test_range(self):
        """Test range conversion."""
        result = _crontab_dow_to_name("1-5")
        assert result == "mon-fri"

    def test_step(self):
        """Test step conversion."""
        result = _crontab_dow_to_name("*/2")
        assert result == "*/2"


class TestScheduleSpec:
    """Tests for ScheduleSpec model."""

    def test_create_cron_schedule(self):
        """Test creating cron schedule."""
        schedule = ScheduleSpec(cron="0 9 * * mon")

        assert schedule.type == "cron"
        assert schedule.cron == "0 9 * * mon"
        assert schedule.timezone == "UTC"

    def test_normalize_5_field_cron(self):
        """Test 5-field cron normalization."""
        schedule = ScheduleSpec(cron="0 9 * * 1")

        # Day 1 (Monday in crontab) should be converted to 'mon'
        assert "mon" in schedule.cron

    def test_normalize_4_field_cron(self):
        """Test 4-field cron normalization."""
        schedule = ScheduleSpec(cron="9 * * mon")

        # Should prepend 0 for minute
        assert schedule.cron.startswith("0 9")

    def test_normalize_3_field_cron(self):
        """Test 3-field cron normalization."""
        schedule = ScheduleSpec(cron="* * mon")

        # Should prepend 0 0 for minute hour
        assert schedule.cron.startswith("0 0")

    def test_invalid_cron_raises(self):
        """Test that invalid cron raises ValueError."""
        with pytest.raises(ValueError):
            ScheduleSpec(cron="invalid")

    def test_custom_timezone(self):
        """Test custom timezone."""
        schedule = ScheduleSpec(cron="0 9 * * *", timezone="America/New_York")

        assert schedule.timezone == "America/New_York"


class TestDispatchTarget:
    """Tests for DispatchTarget model."""

    def test_create_target(self):
        """Test creating dispatch target."""
        target = DispatchTarget(
            user_id="user123",
            session_id="console:user123",
        )

        assert target.user_id == "user123"
        assert target.session_id == "console:user123"


class TestDispatchSpec:
    """Tests for DispatchSpec model."""

    def test_create_dispatch_spec(self):
        """Test creating dispatch spec."""
        target = DispatchTarget(user_id="user123", session_id="console:user123")
        dispatch = DispatchSpec(target=target)

        assert dispatch.type == "channel"
        assert dispatch.channel == "console"
        assert dispatch.mode == "stream"

    def test_dispatch_spec_with_custom_channel(self):
        """Test dispatch spec with custom channel."""
        target = DispatchTarget(user_id="user123", session_id="discord:456")
        dispatch = DispatchSpec(channel="discord", target=target)

        assert dispatch.channel == "discord"

    def test_dispatch_spec_with_meta(self):
        """Test dispatch spec with metadata."""
        target = DispatchTarget(user_id="user123", session_id="console:user123")
        dispatch = DispatchSpec(target=target, meta={"key": "value"})

        assert dispatch.meta["key"] == "value"


class TestJobRuntimeSpec:
    """Tests for JobRuntimeSpec model."""

    def test_default_values(self):
        """Test default runtime values."""
        runtime = JobRuntimeSpec()

        assert runtime.max_concurrency == 1
        assert runtime.timeout_seconds == 120
        assert runtime.misfire_grace_seconds == 60

    def test_custom_values(self):
        """Test custom runtime values."""
        runtime = JobRuntimeSpec(
            max_concurrency=5,
            timeout_seconds=300,
            misfire_grace_seconds=120,
        )

        assert runtime.max_concurrency == 5
        assert runtime.timeout_seconds == 300


class TestCronJobRequest:
    """Tests for CronJobRequest model."""

    def test_create_request_with_input(self):
        """Test creating request with input."""
        request = CronJobRequest(input="Hello")

        assert request.input == "Hello"
        assert request.session_id is None
        assert request.user_id is None

    def test_request_allows_extra_fields(self):
        """Test that request allows extra fields."""
        request = CronJobRequest(
            input="Hello",
            session_id="console:user",
            extra_field="extra_value",
        )

        assert request.session_id == "console:user"
        assert hasattr(request, "extra_field")


class TestCronJobSpec:
    """Tests for CronJobSpec model."""

    def test_create_text_job(self):
        """Test creating text-type cron job."""
        schedule = ScheduleSpec(cron="0 9 * * *")
        target = DispatchTarget(user_id="user", session_id="console:user")
        dispatch = DispatchSpec(target=target)

        job = CronJobSpec(
            id="job-001",
            name="Daily Greeting",
            schedule=schedule,
            task_type="text",
            text="Good morning!",
            dispatch=dispatch,
        )

        assert job.id == "job-001"
        assert job.name == "Daily Greeting"
        assert job.task_type == "text"
        assert job.enabled is True

    def test_create_agent_job(self):
        """Test creating agent-type cron job."""
        schedule = ScheduleSpec(cron="0 9 * * *")
        target = DispatchTarget(user_id="user", session_id="console:user")
        dispatch = DispatchSpec(target=target)
        request = CronJobRequest(input="Hello")

        job = CronJobSpec(
            id="job-002",
            name="Agent Task",
            schedule=schedule,
            task_type="agent",
            request=request,
            dispatch=dispatch,
        )

        assert job.task_type == "agent"
        assert job.request is not None

    def test_text_job_requires_text(self):
        """Test that text job requires text field."""
        schedule = ScheduleSpec(cron="0 9 * * *")
        target = DispatchTarget(user_id="user", session_id="console:user")
        dispatch = DispatchSpec(target=target)

        with pytest.raises(ValueError):
            CronJobSpec(
                id="job-001",
                name="Text Job",
                schedule=schedule,
                task_type="text",
                dispatch=dispatch,
            )

    def test_agent_job_requires_request(self):
        """Test that agent job requires request field."""
        schedule = ScheduleSpec(cron="0 9 * * *")
        target = DispatchTarget(user_id="user", session_id="console:user")
        dispatch = DispatchSpec(target=target)

        with pytest.raises(ValueError):
            CronJobSpec(
                id="job-001",
                name="Agent Job",
                schedule=schedule,
                task_type="agent",
                dispatch=dispatch,
            )

    def test_agent_job_syncs_user_and_session(self):
        """Test that agent job syncs user_id and session_id from target."""
        schedule = ScheduleSpec(cron="0 9 * * *")
        target = DispatchTarget(user_id="target_user", session_id="target_session")
        dispatch = DispatchSpec(target=target)
        request = CronJobRequest(input="Hello", user_id="old_user")

        job = CronJobSpec(
            id="job-001",
            name="Agent Job",
            schedule=schedule,
            task_type="agent",
            request=request,
            dispatch=dispatch,
        )

        # Request should be updated with target values
        assert job.request.user_id == "target_user"
        assert job.request.session_id == "target_session"


class TestCronJobState:
    """Tests for CronJobState model."""

    def test_default_state(self):
        """Test default job state."""
        state = CronJobState()

        assert state.next_run_at is None
        assert state.last_run_at is None
        assert state.last_status is None

    def test_state_with_values(self):
        """Test state with values."""
        from datetime import datetime

        now = datetime.now()
        state = CronJobState(
            next_run_at=now,
            last_status="success",
        )

        assert state.next_run_at == now
        assert state.last_status == "success"


class TestCronJobView:
    """Tests for CronJobView model."""

    def test_create_view(self):
        """Test creating job view."""
        schedule = ScheduleSpec(cron="0 9 * * *")
        target = DispatchTarget(user_id="user", session_id="console:user")
        dispatch = DispatchSpec(target=target)

        job = CronJobSpec(
            id="job-001",
            name="Test Job",
            schedule=schedule,
            task_type="text",
            text="Hello",
            dispatch=dispatch,
        )

        view = CronJobView(spec=job)

        assert view.spec.id == "job-001"
        assert view.state.last_status is None


class TestJobsFile:
    """Tests for JobsFile model."""

    def test_empty_jobs_file(self):
        """Test empty jobs file."""
        jobs_file = JobsFile()

        assert jobs_file.version == 1
        assert jobs_file.jobs == []

    def test_jobs_file_with_jobs(self):
        """Test jobs file with jobs."""
        schedule = ScheduleSpec(cron="0 9 * * *")
        target = DispatchTarget(user_id="user", session_id="console:user")
        dispatch = DispatchSpec(target=target)

        job = CronJobSpec(
            id="job-001",
            name="Test Job",
            schedule=schedule,
            task_type="text",
            text="Hello",
            dispatch=dispatch,
        )

        jobs_file = JobsFile(jobs=[job])

        assert len(jobs_file.jobs) == 1
