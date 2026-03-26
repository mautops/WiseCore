# -*- coding: utf-8 -*-
"""Unit tests for Keycloak token validation."""

from __future__ import annotations

import os
import time
from unittest.mock import MagicMock, patch

import pytest


class TestKeycloakConfig:
    """Tests for Keycloak configuration functions."""

    def test_keycloak_auth_configured_false_by_default(self):
        """Test that Keycloak auth is not configured by default."""
        from wisecore.app.keycloak_token import keycloak_auth_configured

        with patch.dict(os.environ, {"KEYCLOAK_ISSUER": ""}, clear=False):
            assert keycloak_auth_configured() is False

    def test_keycloak_auth_configured_true_with_issuer(self):
        """Test that Keycloak auth is configured with issuer."""
        from wisecore.app.keycloak_token import keycloak_auth_configured

        with patch.dict(
            os.environ,
            {"KEYCLOAK_ISSUER": "https://keycloak.example.com/realms/test"},
            clear=False,
        ):
            assert keycloak_auth_configured() is True

    def test_audience_config(self):
        """Test audience configuration."""
        from wisecore.app.keycloak_token import _audience_config

        with patch.dict(
            os.environ,
            {"KEYCLOAK_AUDIENCE": "my-client"},
            clear=False,
        ):
            assert _audience_config() == "my-client"

    def test_jwt_algorithms_default(self):
        """Test default JWT algorithms."""
        from wisecore.app.keycloak_token import _jwt_algorithms

        with patch.dict(os.environ, {}, clear=False):
            assert _jwt_algorithms() == ["RS256"]

    def test_jwt_algorithms_custom(self):
        """Test custom JWT algorithms."""
        from wisecore.app.keycloak_token import _jwt_algorithms

        with patch.dict(
            os.environ,
            {"KEYCLOAK_JWT_ALGORITHMS": "RS256,RS512"},
            clear=False,
        ):
            assert _jwt_algorithms() == ["RS256", "RS512"]


class TestVerifyKeycloakAccessToken:
    """Tests for Keycloak access token verification."""

    def test_verify_returns_none_when_not_configured(self):
        """Test that verification returns None when not configured."""
        from wisecore.app.keycloak_token import verify_keycloak_access_token

        with patch.dict(os.environ, {"KEYCLOAK_ISSUER": ""}, clear=False):
            result = verify_keycloak_access_token("some.token.here")

        assert result is None

    def test_verify_returns_none_for_invalid_format(self):
        """Test that verification returns None for invalid token format."""
        from wisecore.app.keycloak_token import verify_keycloak_access_token

        with patch.dict(
            os.environ,
            {"KEYCLOAK_ISSUER": "https://keycloak.example.com/realms/test"},
            clear=False,
        ):
            # Token without proper JWT format
            result = verify_keycloak_access_token("invalid-token")

        assert result is None

    def test_verify_returns_none_for_wrong_segment_count(self):
        """Test that verification returns None for wrong segment count."""
        from wisecore.app.keycloak_token import verify_keycloak_access_token

        with patch.dict(
            os.environ,
            {"KEYCLOAK_ISSUER": "https://keycloak.example.com/realms/test"},
            clear=False,
        ):
            # Token with only two segments
            result = verify_keycloak_access_token("only.two")

        assert result is None


class TestApplyKeycloakTokenClaims:
    """Tests for applying Keycloak token claims to request state."""

    def test_apply_claims_sets_user(self, sample_jwt_payload: dict):
        """Test that claims are applied to request state."""
        from wisecore.app.auth import apply_keycloak_token_claims_to_request_state

        mock_request = MagicMock()
        mock_request.state = MagicMock()

        apply_keycloak_token_claims_to_request_state(
            mock_request,
            "test_token",
            sample_jwt_payload,
        )

        assert mock_request.state.user == "testuser"
        assert mock_request.state.cli_access_token == "test_token"

    def test_apply_claims_sets_aliases(self, sample_jwt_payload: dict):
        """Test that aliases are set from claims."""
        from wisecore.app.auth import apply_keycloak_token_claims_to_request_state

        mock_request = MagicMock()
        mock_request.state = MagicMock()

        apply_keycloak_token_claims_to_request_state(
            mock_request,
            "test_token",
            sample_jwt_payload,
        )

        assert hasattr(mock_request.state, "wisecore_chat_aliases")
        assert "testuser" in mock_request.state.wisecore_chat_aliases
        assert "test@example.com" in mock_request.state.wisecore_chat_aliases


class TestExtractAccessToken:
    """Tests for access token extraction from request."""

    def test_extract_from_x_access_token_header(self):
        """Test extraction from X-Access-Token header."""
        from wisecore.app.auth import _extract_access_token_header

        mock_request = MagicMock()
        mock_request.headers.get.return_value = "my_token"

        result = _extract_access_token_header(mock_request)

        assert result == "my_token"

    def test_extract_from_authorization_bearer(self):
        """Test extraction from Authorization Bearer header."""
        from wisecore.app.auth import _extract_access_token_header

        mock_request = MagicMock()
        mock_request.headers.get.side_effect = lambda k, d="": {
            "X-Access-Token": "",
            "Authorization": "Bearer my_bearer_token",
        }.get(k, d)

        result = _extract_access_token_header(mock_request)

        assert result == "my_bearer_token"

    def test_extract_from_query_for_websocket(self):
        """Test extraction from query params for WebSocket upgrade."""
        from wisecore.app.auth import _extract_access_token_header

        mock_request = MagicMock()
        mock_request.headers.get.side_effect = lambda k, d="": {
            "X-Access-Token": "",
            "Authorization": "",
            "connection": "upgrade",
        }.get(k, d)
        mock_request.query_params.get.return_value = "ws_token"

        result = _extract_access_token_header(mock_request)

        assert result == "ws_token"
