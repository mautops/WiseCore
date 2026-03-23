# -*- coding: utf-8 -*-
"""Authentication module: password hashing, JWT tokens, and FastAPI middleware.

Login is disabled by default and only enabled when the environment
variable ``COPAW_AUTH_ENABLED`` is set to a truthy value (``true``,
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
import binascii
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import time
from typing import Any, Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from ..constant import SECRET_DIR

logger = logging.getLogger(__name__)

AUTH_FILE = SECRET_DIR / "auth.json"

# Token validity: 7 days
TOKEN_EXPIRY_SECONDS = 7 * 24 * 3600

# Paths that do NOT require authentication
_PUBLIC_PATHS: frozenset[str] = frozenset(
    {
        "/api/auth/login",
        "/api/auth/status",
        "/api/auth/register",
        "/api/version",
    },
)

# Prefixes that do NOT require authentication (static assets)
_PUBLIC_PREFIXES: tuple[str, ...] = (
    "/assets/",
    "/logo.png",
    "/copaw-symbol.svg",
)


# ---------------------------------------------------------------------------
# Helpers (reuse SECRET_DIR patterns from envs/store.py)
# ---------------------------------------------------------------------------


def _chmod_best_effort(path, mode: int) -> None:
    try:
        os.chmod(path, mode)
    except OSError:
        pass


def _prepare_secret_parent(path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    _chmod_best_effort(path.parent, 0o700)


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
    import base64

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
    import base64

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
    _prepare_secret_parent(AUTH_FILE)
    with open(AUTH_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    _chmod_best_effort(AUTH_FILE, 0o600)


def is_auth_enabled() -> bool:
    """Check whether authentication is enabled via environment variable.

    Returns ``True`` when ``COPAW_AUTH_ENABLED`` is set to a truthy
    value (``true``, ``1``, ``yes``).  The presence of a registered
    user is checked separately by the middleware so that the first
    user can still reach the registration page.
    """
    env_flag = os.environ.get("COPAW_AUTH_ENABLED", "").strip().lower()
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

    Called once during application startup.  If ``COPAW_AUTH_ENABLED``
    is truthy and both ``COPAW_AUTH_USERNAME`` and ``COPAW_AUTH_PASSWORD``
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

    username = os.environ.get("COPAW_AUTH_USERNAME", "").strip()
    password = os.environ.get("COPAW_AUTH_PASSWORD", "").strip()
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


# ---------------------------------------------------------------------------
# Upstream HS256 JWT (hi-ops Better Auth proxy, Bearer / X-Access-Token)
# ---------------------------------------------------------------------------


def _upstream_jwt_secret() -> str:
    return (
        os.environ.get("COPAW_UPSTREAM_JWT_SECRET", "").strip()
        or os.environ.get("BETTER_AUTH_SECRET", "").strip()
    )


def _b64url_decode(segment: str) -> bytes:
    pad = "=" * ((4 - len(segment) % 4) % 4)
    return base64.urlsafe_b64decode(segment + pad)


def _verify_hs256_jwt(token: str, secret: str) -> Optional[dict[str, Any]]:
    parts = token.split(".")
    if len(parts) != 3:
        return None
    header_b64, payload_b64, sig_b64 = parts
    try:
        header = json.loads(_b64url_decode(header_b64))
    except (json.JSONDecodeError, ValueError, binascii.Error):
        return None
    if header.get("alg") != "HS256":
        return None
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    expected_sig = hmac.new(
        secret.encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    try:
        sig_bytes = _b64url_decode(sig_b64)
    except (ValueError, binascii.Error):
        return None
    if not secrets.compare_digest(sig_bytes, expected_sig):
        return None
    try:
        payload = json.loads(_b64url_decode(payload_b64))
    except (json.JSONDecodeError, ValueError):
        return None
    exp = payload.get("exp")
    if exp is not None:
        try:
            if int(exp) < int(time.time()):
                return None
        except (TypeError, ValueError):
            return None
    return payload


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


def _username_from_jwt_payload(payload: dict[str, Any]) -> Optional[str]:
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


def _resolve_user_from_access_token(token: str) -> Optional[str]:
    t = token.strip()
    if not t:
        return None
    parts = t.split(".")
    if len(parts) == 2:
        return verify_token(t)
    if len(parts) != 3:
        return None
    secret = _upstream_jwt_secret()
    if not secret:
        return None
    payload = _verify_hs256_jwt(t, secret)
    if not payload:
        return None
    return _username_from_jwt_payload(payload)


def _extract_access_token_header(request: Request) -> Optional[str]:
    x = request.headers.get("X-Access-Token", "").strip()
    if x:
        return x
    auth = request.headers.get("Authorization", "").strip()
    if auth.startswith("Bearer "):
        return auth[7:].strip()
    return None


class AccessTokenUserMiddleware(BaseHTTPMiddleware):
    """Set ``request.state.user`` from verified CoPaw token or HS256 upstream JWT."""

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)
        if not request.url.path.startswith("/api/"):
            return await call_next(request)
        raw = _extract_access_token_header(request)
        if not raw:
            return await call_next(request)
        user = _resolve_user_from_access_token(raw)
        if user:
            request.state.user = user
        return await call_next(request)


# ---------------------------------------------------------------------------
# FastAPI middleware
# ---------------------------------------------------------------------------


class AuthMiddleware(BaseHTTPMiddleware):
    """Middleware that checks Bearer token on protected routes."""

    async def dispatch(
        self,
        request: Request,
        call_next,
    ) -> Response:
        """Check Bearer token on protected API routes; skip public paths."""
        if self._should_skip_auth(request):
            return await call_next(request)

        existing = getattr(request.state, "user", None)
        if existing:
            return await call_next(request)

        token = self._extract_token(request)
        if not token:
            return Response(
                content=json.dumps({"detail": "Not authenticated"}),
                status_code=401,
                media_type="application/json",
            )

        user = verify_token(token)
        if user is None:
            return Response(
                content=json.dumps(
                    {"detail": "Invalid or expired token"},
                ),
                status_code=401,
                media_type="application/json",
            )

        request.state.user = user
        return await call_next(request)

    @staticmethod
    def _should_skip_auth(request: Request) -> bool:
        """Return ``True`` when the request does not require auth."""
        if not is_auth_enabled() or not has_registered_users():
            return True

        path = request.url.path

        if request.method == "OPTIONS":
            return True

        if path in _PUBLIC_PATHS or any(path.startswith(p) for p in _PUBLIC_PREFIXES):
            return True

        # Only protect /api/ routes
        if not path.startswith("/api/"):
            return True

        # Allow localhost requests without auth (CLI runs locally)
        client_host = request.client.host if request.client else ""
        return client_host in ("127.0.0.1", "::1")

    @staticmethod
    def _extract_token(request: Request) -> Optional[str]:
        """Extract Bearer token from header or WebSocket query param."""
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            return auth_header[7:]
        if "upgrade" in request.headers.get("connection", "").lower():
            return request.query_params.get("token")
        return None
