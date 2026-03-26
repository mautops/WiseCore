# -*- coding: utf-8 -*-
"""Integration tests for authentication system."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


class TestAuthIntegration:
    """Integration tests for authentication system."""

    @pytest.mark.integration
    def test_password_auth_flow(self, integration_temp_dir: Path):
        """Test complete password authentication flow."""
        from wisecore.app.auth import (
            register_user,
            authenticate,
            verify_token,
            has_registered_users,
        )

        auth_file = integration_temp_dir / "auth.json"

        with patch("wisecore.app.auth.AUTH_FILE", auth_file):
            # Initially no users
            assert has_registered_users() is False

            # Register user
            token = register_user("testuser", "secure_password123")
            assert token is not None

            # Now we have users
            assert has_registered_users() is True

            # Authenticate with correct password
            auth_token = authenticate("testuser", "secure_password123")
            assert auth_token is not None

            # Verify the token
            username = verify_token(auth_token)
            assert username == "testuser"

            # Wrong password should fail
            wrong_auth = authenticate("testuser", "wrong_password")
            assert wrong_auth is None

    @pytest.mark.integration
    def test_token_persistence(self, integration_temp_dir: Path):
        """Test that tokens persist and remain valid."""
        import time

        from wisecore.app.auth import create_token, verify_token

        # Create token
        token = create_token("persistent_user")

        # Verify immediately
        assert verify_token(token) == "persistent_user"

        # Verify after short delay
        time.sleep(0.1)
        assert verify_token(token) == "persistent_user"

    @pytest.mark.integration
    def test_single_user_registration(self, integration_temp_dir: Path):
        """Test that only one user can be registered."""
        from wisecore.app.auth import register_user

        auth_file = integration_temp_dir / "auth.json"

        with patch("wisecore.app.auth.AUTH_FILE", auth_file):
            first_token = register_user("first_user", "password1")
            second_token = register_user("second_user", "password2")

            assert first_token is not None
            assert second_token is None  # Second registration should fail


class TestKeycloakIntegration:
    """Integration tests for Keycloak authentication."""

    @pytest.mark.integration
    def test_keycloak_disabled_without_config(self):
        """Test that Keycloak auth is disabled without config."""
        from wisecore.app.keycloak_token import (
            keycloak_auth_configured,
            verify_keycloak_access_token,
        )
        import os

        with patch.dict(os.environ, {"KEYCLOAK_ISSUER": ""}, clear=False):
            assert keycloak_auth_configured() is False

            # Should return None when not configured
            result = verify_keycloak_access_token("any_token")
            assert result is None

    @pytest.mark.integration
    def test_keycloak_token_validation_with_invalid_token(self):
        """Test Keycloak token validation with invalid token."""
        from wisecore.app.keycloak_token import verify_keycloak_access_token
        import os

        with patch.dict(
            os.environ,
            {"KEYCLOAK_ISSUER": "https://keycloak.example.com/realms/test"},
            clear=False,
        ):
            # Invalid format token should return None
            result = verify_keycloak_access_token("invalid_token_format")
            assert result is None

            # Token with wrong segment count should return None
            result = verify_keycloak_access_token("only.two")
            assert result is None


class TestAuthZIntegration:
    """Integration tests for authorization."""

    @pytest.mark.integration
    def test_channel_allowlist_policy(self):
        """Test channel allowlist policy enforcement."""
        from wisecore.app.channels.base import BaseChannel

        # Create a mock channel instance
        mock_channel = MagicMock(spec=BaseChannel)
        mock_channel.dm_policy = "allowlist"
        mock_channel.group_policy = "open"
        mock_channel.allow_from = {"allowed_user", "another_user"}
        mock_channel.deny_message = "Access denied"

        # Test open policy (group) - should allow
        allowed, msg = BaseChannel._check_allowlist(
            mock_channel, "any_user", is_group=True
        )
        assert allowed is True
        assert msg is None

        # Test allowlist policy with allowed user
        allowed, msg = BaseChannel._check_allowlist(
            mock_channel, "allowed_user", is_group=False
        )
        assert allowed is True
        assert msg is None

        # Test allowlist policy with non-allowed user
        allowed, msg = BaseChannel._check_allowlist(
            mock_channel, "blocked_user", is_group=False
        )
        assert allowed is False
        assert msg is not None
