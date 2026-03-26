# -*- coding: utf-8 -*-
"""Unit tests for authentication module."""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from unittest.mock import patch

import pytest


class TestPasswordHashing:
    """Tests for password hashing functions."""

    def test_hash_password_returns_tuple(self):
        """Test that _hash_password returns a tuple."""
        from wisecore.app.auth import _hash_password

        result = _hash_password("test_password")
        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_hash_password_different_salts(self):
        """Test that different salts produce different hashes."""
        from wisecore.app.auth import _hash_password

        hash1, salt1 = _hash_password("password")
        hash2, salt2 = _hash_password("password")

        assert hash1 != hash2  # Different hashes due to different salts
        assert salt1 != salt2

    def test_hash_password_with_provided_salt(self):
        """Test hashing with a provided salt."""
        from wisecore.app.auth import _hash_password

        salt = "fixed_salt_12345"
        hash1, returned_salt = _hash_password("password", salt)

        assert returned_salt == salt

    def test_verify_password_correct(self):
        """Test password verification with correct password."""
        from wisecore.app.auth import _hash_password, verify_password

        password = "correct_password"
        hash_val, salt = _hash_password(password)

        assert verify_password(password, hash_val, salt) is True

    def test_verify_password_incorrect(self):
        """Test password verification with incorrect password."""
        from wisecore.app.auth import _hash_password, verify_password

        hash_val, salt = _hash_password("correct_password")

        assert verify_password("wrong_password", hash_val, salt) is False


class TestTokenGeneration:
    """Tests for JWT token generation and verification."""

    def test_create_token_returns_string(self):
        """Test that create_token returns a string."""
        from wisecore.app.auth import create_token

        token = create_token("testuser")

        assert isinstance(token, str)
        assert "." in token  # JWT format: payload.signature

    def test_verify_valid_token(self):
        """Test verification of a valid token."""
        from wisecore.app.auth import create_token, verify_token

        token = create_token("testuser")
        username = verify_token(token)

        assert username == "testuser"

    def test_verify_invalid_token(self):
        """Test verification of an invalid token."""
        from wisecore.app.auth import verify_token

        result = verify_token("invalid.token.here")
        assert result is None

    def test_verify_expired_token(self):
        """Test verification of an expired token."""
        from wisecore.app.auth import create_token, verify_token

        # Create a token and mock time to make it expired
        token = create_token("testuser")

        with patch("time.time", return_value=time.time() + 8 * 24 * 3600):
            result = verify_token(token)

        assert result is None


class TestAuthEnabled:
    """Tests for authentication enabled check."""

    def test_is_auth_enabled_default_false(self):
        """Test that auth is disabled by default."""
        from wisecore.app.auth import is_auth_enabled

        with patch.dict(os.environ, {"AUTH_ENABLED": ""}, clear=False):
            assert is_auth_enabled() is False

    def test_is_auth_enabled_with_true(self):
        """Test that auth is enabled with truthy values."""
        from wisecore.app.auth import is_auth_enabled

        for value in ["true", "1", "yes", "TRUE", "True"]:
            with patch.dict(os.environ, {"AUTH_ENABLED": value}, clear=False):
                assert is_auth_enabled() is True


class TestUserRegistration:
    """Tests for user registration."""

    def test_register_user_success(self, temp_dir: Path):
        """Test successful user registration."""
        from wisecore.app.auth import register_user

        auth_file = temp_dir / "auth.json"

        with patch("wisecore.app.auth.AUTH_FILE", auth_file):
            token = register_user("testuser", "password123")

        assert token is not None
        assert isinstance(token, str)

    def test_register_user_only_one_allowed(self, temp_dir: Path):
        """Test that only one user can be registered."""
        from wisecore.app.auth import register_user

        auth_file = temp_dir / "auth.json"

        with patch("wisecore.app.auth.AUTH_FILE", auth_file):
            token1 = register_user("user1", "password1")
            token2 = register_user("user2", "password2")

        assert token1 is not None
        assert token2 is None  # Second registration should fail

    def test_has_registered_users(self, temp_dir: Path):
        """Test checking if users are registered."""
        from wisecore.app.auth import has_registered_users, register_user

        auth_file = temp_dir / "auth.json"

        with patch("wisecore.app.auth.AUTH_FILE", auth_file):
            assert has_registered_users() is False

            register_user("testuser", "password")

            assert has_registered_users() is True


class TestAuthenticate:
    """Tests for authentication."""

    def test_authenticate_correct_credentials(self, temp_dir: Path):
        """Test authentication with correct credentials."""
        from wisecore.app.auth import authenticate, register_user

        auth_file = temp_dir / "auth.json"

        with patch("wisecore.app.auth.AUTH_FILE", auth_file):
            register_user("testuser", "correct_password")
            token = authenticate("testuser", "correct_password")

        assert token is not None

    def test_authenticate_wrong_password(self, temp_dir: Path):
        """Test authentication with wrong password."""
        from wisecore.app.auth import authenticate, register_user

        auth_file = temp_dir / "auth.json"

        with patch("wisecore.app.auth.AUTH_FILE", auth_file):
            register_user("testuser", "correct_password")
            token = authenticate("testuser", "wrong_password")

        assert token is None

    def test_authenticate_nonexistent_user(self, temp_dir: Path):
        """Test authentication with nonexistent user."""
        from wisecore.app.auth import authenticate

        auth_file = temp_dir / "auth.json"

        with patch("wisecore.app.auth.AUTH_FILE", auth_file):
            token = authenticate("nonexistent", "password")

        assert token is None
