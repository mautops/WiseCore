# -*- coding: utf-8 -*-
"""Authentication module: password hashing, JWT tokens, and FastAPI middleware.

Login is disabled by default and only enabled when the environment
variable ``AUTH_ENABLED`` is set to a truthy value (``true``,
``1``, ``yes``).  Credentials are created through a web-based
registration flow rather than environment variables, so that agents
running inside the process cannot read plaintext passwords.

Single-user design: only one account can be registered.  If the user
forgets their password, delete ``auth.json`` from ``SECRET_DIR`` and
restart the service to re-register.

Uses only Python stdlib (hashlib, hmac, secrets) to avoid adding new
dependencies.  The password is stored as a salted SHA-256 hash in
``auth.json`` under ``SECRET_DIR``.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import time
from typing import Any, Optional

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from ..constant import SECRET_DIR
from ..utils.fs_utils import chmod_best_effort, prepare_secret_parent
from .keycloak_token import (
    keycloak_auth_configured,
    verify_keycloak_access_token,
)
from .workspace_subject import sanitize_workspace_owner_segment

logger = logging.getLogger(__name__)

AUTH_FILE = SECRET_DIR / "auth.json"

# Token validity: 7 days
TOKEN_EXPIRY_SECONDS = 7 * 24 * 3600

# ---------------------------------------------------------------------------
# Password hashing (salted SHA-256, no external deps)
# ---------------------------------------------------------------------------


def _hash_password(
    password: str,
    salt: Optional[str] = None,
) -> tuple[str, str]:
    """Hash *password* with *salt*.  Returns ``(hash_hex, salt_hex)``."""
    if salt is None:
        salt = secrets.token_hex(16)
    h = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
    return h, salt


def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    """Verify *password* against a stored hash."""
    h, _ = _hash_password(password, salt)
    return hmac.compare_digest(h, stored_hash)


# ---------------------------------------------------------------------------
# Token generation / verification (HMAC-SHA256, no PyJWT needed)
# ---------------------------------------------------------------------------


def _get_jwt_secret() -> str:
    """Return the signing secret, creating one if absent."""
    data = _load_auth_data()
    secret = data.get("jwt_secret", "")
    if not secret:
        secret = secrets.token_hex(32)
        data["jwt_secret"] = secret
        _save_auth_data(data)
    return secret


def create_token(username: str) -> str:
    """Create an HMAC-signed token: ``base64(payload).signature``."""
    secret = _get_jwt_secret()
    payload = json.dumps(
        {
            "sub": username,
            "exp": int(time.time()) + TOKEN_EXPIRY_SECONDS,
            "iat": int(time.time()),
        },
    )
    payload_b64 = base64.urlsafe_b64encode(payload.encode()).decode()
    sig = hmac.new(
        secret.encode(),
        payload_b64.encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload_b64}.{sig}"


def verify_token(token: str) -> Optional[str]:
    """Verify *token*, return username if valid, ``None`` otherwise."""
    try:
        parts = token.split(".", 1)
        if len(parts) != 2:
            return None
        payload_b64, sig = parts
        secret = _get_jwt_secret()
        expected_sig = hmac.new(
            secret.encode(),
            payload_b64.encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        if payload.get("exp", 0) < time.time():
            return None
        return payload.get("sub")
    except (json.JSONDecodeError, KeyError, ValueError, TypeError) as exc:
        logger.debug("Token verification failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Auth data persistence (auth.json in SECRET_DIR)
# ---------------------------------------------------------------------------


def _load_auth_data() -> dict:
    """Load ``auth.json`` from ``SECRET_DIR``.

    Returns the parsed dict, or a sentinel with ``_auth_load_error``
    set to ``True`` when the file exists but cannot be read/parsed so
    that callers can fail closed instead of silently bypassing auth.
    """
    if AUTH_FILE.is_file():
        try:
            with open(AUTH_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError) as exc:
            logger.error("Failed to load auth file %s: %s", AUTH_FILE, exc)
            return {"_auth_load_error": True}
    return {}


def _save_auth_data(data: dict) -> None:
    """Save ``auth.json`` to ``SECRET_DIR`` with restrictive permissions."""
    prepare_secret_parent(AUTH_FILE)
    with open(AUTH_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    chmod_best_effort(AUTH_FILE, 0o600)


def is_auth_enabled() -> bool:
    """Check whether authentication is enabled via environment variable.

    Returns ``True`` when ``AUTH_ENABLED`` is set to a truthy
    value (``true``, ``1``, ``yes``).  The presence of a registered
    user is checked separately by the middleware so that the first
    user can still reach the registration page.
    """
    env_flag = os.environ.get("AUTH_ENABLED", "").strip().lower()
    return env_flag in ("true", "1", "yes")


def has_registered_users() -> bool:
    """Return ``True`` if a user has been registered."""
    data = _load_auth_data()
    return bool(data.get("user"))


# ---------------------------------------------------------------------------
# Registration (single-user)
# ---------------------------------------------------------------------------


def register_user(username: str, password: str) -> Optional[str]:
    """Register the single user account.

    Returns a token on success, ``None`` if a user already exists.
    """
    data = _load_auth_data()

    # Only one user allowed
    if data.get("user"):
        return None

    pw_hash, salt = _hash_password(password)
    data["user"] = {
        "username": username,
        "password_hash": pw_hash,
        "password_salt": salt,
    }

    # Ensure jwt_secret exists
    if not data.get("jwt_secret"):
        data["jwt_secret"] = secrets.token_hex(32)

    _save_auth_data(data)
    logger.info("User '%s' registered", username)
    return create_token(username)


def auto_register_from_env() -> None:
    """Auto-register admin user from environment variables.

    Called once during application startup.  If ``AUTH_ENABLED``
    is truthy and both ``AUTH_USERNAME`` and ``AUTH_PASSWORD``
    are set, the admin account is created automatically — useful for
    Docker, Kubernetes, server-panel, and other automated deployments
    where interactive web registration is not practical.

    Skips silently when:
    - authentication is not enabled
    - a user has already been registered
    - either env var is missing or empty
    """
    if not is_auth_enabled():
        return
    if has_registered_users():
        return

    username = os.environ.get("AUTH_USERNAME", "").strip()
    password = os.environ.get("AUTH_PASSWORD", "").strip()
    if not username or not password:
        return

    token = register_user(username, password)
    if token:
        logger.info(
            "Auto-registered user '%s' from environment variables",
            username,
        )


def update_credentials(
    current_password: str,
    new_username: Optional[str] = None,
    new_password: Optional[str] = None,
) -> Optional[str]:
    """Update the registered user's username and/or password.

    Requires the current password for verification.  Returns a new
    token on success (because the username may have changed), or
    ``None`` if verification fails.
    """
    data = _load_auth_data()
    user = data.get("user")
    if not user:
        return None

    stored_hash = user.get("password_hash", "")
    stored_salt = user.get("password_salt", "")
    if not verify_password(current_password, stored_hash, stored_salt):
        return None

    if new_username and new_username.strip():
        user["username"] = new_username.strip()

    if new_password:
        pw_hash, salt = _hash_password(new_password)
        user["password_hash"] = pw_hash
        user["password_salt"] = salt
        # Rotate JWT secret to invalidate all existing sessions
        data["jwt_secret"] = secrets.token_hex(32)

    data["user"] = user
    _save_auth_data(data)
    logger.info("Credentials updated for user '%s'", user["username"])
    return create_token(user["username"])


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------


def authenticate(username: str, password: str) -> Optional[str]:
    """Authenticate *username* / *password*.  Returns a token if valid."""
    data = _load_auth_data()
    user = data.get("user")
    if not user:
        return None
    if user.get("username") != username:
        return None
    stored_hash = user.get("password_hash", "")
    stored_salt = user.get("password_salt", "")
    if (
        stored_hash
        and stored_salt
        and verify_password(password, stored_hash, stored_salt)
    ):
        return create_token(username)
    return None


_UUID_WORKFLOW_SEGMENT = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.I,
)


def _workflow_segment_from_claim_value(value: object) -> Optional[str]:
    if not isinstance(value, str):
        return None
    s = value.strip()
    if not s:
        return None
    if "@" in s:
        s = s.split("@", 1)[0].strip()
    if not s or ".." in s:
        return None
    if _UUID_WORKFLOW_SEGMENT.match(s):
        return None
    if re.search(r"[\x00-\x1f/\\\\]", s):
        return None
    return s


def _username_from_token_claims(payload: dict[str, Any]) -> Optional[str]:
    for key in ("preferred_username", "username", "email", "name"):
        seg = _workflow_segment_from_claim_value(payload.get(key))
        if seg:
            return seg
    sub = payload.get("sub")
    if isinstance(sub, str) and sub.strip():
        s = sub.strip()
        if len(s) == 36 and s.count("-") == 4:
            return None
        return _workflow_segment_from_claim_value(s)
    return None


def apply_keycloak_token_claims_to_request_state(
    request: Request,
    token: str,
    payload: dict[str, Any],
) -> None:
    """Set ``request.state`` from verified Keycloak JWT claims."""
    t = token.strip()
    request.state.cli_access_token = t
    user = _username_from_token_claims(payload)
    if user:
        request.state.user = user
    alias_list: list[str] = []
    if user:
        alias_list.append(user)
    em = payload.get("email")
    if isinstance(em, str) and em.strip():
        alias_list.append(em.strip())
    sub_raw = payload.get("sub")
    if isinstance(sub_raw, str) and sub_raw.strip():
        alias_list.append(sub_raw.strip())
    request.state.wisecore_chat_aliases = list(dict.fromkeys(alias_list))
    try:
        if isinstance(sub_raw, str) and sub_raw.strip():
            request.state.wisecore_subject = sanitize_workspace_owner_segment(
                sub_raw.strip(),
            )
        elif user:
            request.state.wisecore_subject = sanitize_workspace_owner_segment(
                user,
            )
    except ValueError:
        logger.warning("Invalid Keycloak subject for workspace path")


def _extract_access_token_header(request: Request) -> Optional[str]:
    x = request.headers.get("X-Access-Token", "").strip()
    if x:
        return x
    auth = request.headers.get("Authorization", "").strip()
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    conn = request.headers.get("connection", "").lower()
    if "upgrade" in conn:
        q = request.query_params.get("token", "").strip()
        if q:
            return q
    return None


class AccessTokenUserMiddleware(BaseHTTPMiddleware):
    """Require Keycloak JWT access token (JWKS) for all ``/api/*`` routes."""

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)
        if not request.url.path.startswith("/api/"):
            return await call_next(request)
        if not keycloak_auth_configured():
            return JSONResponse(
                {"detail": "Keycloak JWT validation is not configured"},
                status_code=503,
            )
        raw = _extract_access_token_header(request)
        if not raw:
            return JSONResponse(
                {"detail": "Not authenticated"}, status_code=401
            )
        payload = verify_keycloak_access_token(raw)
        if not payload:
            return JSONResponse(
                {"detail": "Invalid or expired access token"},
                status_code=401,
            )
        apply_keycloak_token_claims_to_request_state(request, raw, payload)
        return await call_next(request)
