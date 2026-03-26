# -*- coding: utf-8 -*-
"""Validate Keycloak access tokens as JWTs using OIDC JWKS (no introspection).

Many SSO fronts omit ``token_introspection_endpoint`` or block ``/introspect``.
Keycloak still publishes signing keys at ``jwks_uri`` (from discovery) or at
``{issuer}/protocol/openid-connect/certs``.

Environment:

- ``KEYCLOAK_ISSUER``: realm issuer URL (``iss`` claim, no trailing
  slash).
- ``KEYCLOAK_JWKS_URL``: optional JWKS JSON URL
  (overrides discovery / default).
- ``KEYCLOAK_AUDIENCE``: optional; passed to PyJWT ``audience`` when
  set.
- ``KEYCLOAK_EXPECTED_AZP``: optional; when JWT has ``azp``, it must
  match.
- ``KEYCLOAK_REQUIRED_SCOPES``: optional space-separated scopes in JWT
  ``scope`` claim; ``openid`` is ignored (often absent on access tokens).
- ``KEYCLOAK_JWT_ALGORITHMS``: comma-separated algs, default ``RS256``.

Client secret is **not** used here (browser already obtained the token via
OAuth).
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Optional

import httpx
import jwt
from jwt import PyJWKClient

logger = logging.getLogger(__name__)

_JWKS_URL_CACHE: str = ""
_JWKS_URL_AT: float = 0.0
_JWKS_URL_TTL = 3600.0
_PYJWK_CLIENT: Optional[PyJWKClient] = None
_PYJWK_CLIENT_URL: str = ""


def _norm_iss(value: str) -> str:
    return value.strip().rstrip("/")


def _issuer_config() -> str:
    return _norm_iss(os.environ.get("KEYCLOAK_ISSUER", ""))


def _jwks_url_override() -> str:
    return os.environ.get("KEYCLOAK_JWKS_URL", "").strip()


def _audience_config() -> str:
    return os.environ.get("KEYCLOAK_AUDIENCE", "").strip()


def _expected_azp() -> Optional[str]:
    raw = os.environ.get("KEYCLOAK_EXPECTED_AZP", "").strip()
    return raw or None


def _required_scopes() -> frozenset[str]:
    raw = os.environ.get("KEYCLOAK_REQUIRED_SCOPES", "").strip()
    if not raw:
        return frozenset()
    parts = frozenset(p for p in raw.split() if p)
    return parts - frozenset({"openid"})


def _jwt_algorithms() -> list[str]:
    raw = os.environ.get("KEYCLOAK_JWT_ALGORITHMS", "RS256").strip()
    algs = [a.strip() for a in raw.split(",") if a.strip()]
    return algs if algs else ["RS256"]


def _resolve_jwks_url() -> str:
    global _JWKS_URL_CACHE, _JWKS_URL_AT
    override = _jwks_url_override()
    if override:
        return override
    issuer = _issuer_config()
    if not issuer:
        raise RuntimeError("KEYCLOAK_ISSUER is not set")
    now = time.monotonic()
    if _JWKS_URL_CACHE and (now - _JWKS_URL_AT) < _JWKS_URL_TTL:
        return _JWKS_URL_CACHE
    well_known = f"{issuer}/.well-known/openid-configuration"
    resolved = f"{issuer}/protocol/openid-connect/certs"
    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.get(well_known)
            response.raise_for_status()
            doc = response.json()
        uri = doc.get("jwks_uri")
        if isinstance(uri, str) and uri.strip():
            resolved = uri.strip()
    except Exception as exc:
        logger.info(
            "OIDC discovery for jwks_uri failed (%s); using %s",
            exc,
            resolved,
        )
    _JWKS_URL_CACHE = resolved
    _JWKS_URL_AT = now
    return resolved


def keycloak_auth_configured() -> bool:
    return bool(_issuer_config())


def _pyjwk_for_url(jwks_url: str) -> PyJWKClient:
    global _PYJWK_CLIENT, _PYJWK_CLIENT_URL
    if _PYJWK_CLIENT is None or _PYJWK_CLIENT_URL != jwks_url:
        _PYJWK_CLIENT = PyJWKClient(jwks_url, timeout=15)
        _PYJWK_CLIENT_URL = jwks_url
    return _PYJWK_CLIENT


def verify_keycloak_access_token(token: str) -> Optional[dict[str, Any]]:
    """Decode and verify JWT access token; return claims or ``None``."""
    issuer = _issuer_config()
    if not issuer:
        return None

    t = token.strip()
    if not t or t.count(".") != 2:
        logger.debug("Keycloak token is not a JWT (expect three segments)")
        return None

    try:
        jwks_url = _resolve_jwks_url()
    except Exception as exc:
        logger.error("Keycloak JWKS URL resolve failed: %s", exc)
        return None

    try:
        jwk_client = _pyjwk_for_url(jwks_url)
        signing_key = jwk_client.get_signing_key_from_jwt(t)
    except Exception as exc:
        logger.warning("Keycloak JWKS signing key resolve failed: %s", exc)
        return None

    aud = _audience_config()
    try:
        # Decode and verify signature first
        payload = jwt.decode(
            t,
            signing_key.key,
            algorithms=_jwt_algorithms(),
            audience=None,  # We'll verify aud/azp manually below
            options={
                "verify_aud": False,  # Manual verification
                "verify_iss": False,
            },
            leeway=60,
        )
    except jwt.ExpiredSignatureError:
        logger.warning("Keycloak JWT expired")
        return None
    except jwt.InvalidTokenError as exc:
        logger.warning("Keycloak JWT invalid: %s", exc)
        return None

    if not isinstance(payload, dict):
        return None

    # Verify audience/azp manually
    # Keycloak access tokens: aud = resource servers, azp = client ID
    # We accept if expected_aud matches aud (list or string) OR azp
    if aud:
        jwt_aud = payload.get("aud")
        jwt_azp = payload.get("azp")
        aud_match = False
        if isinstance(jwt_aud, str):
            aud_match = jwt_aud == aud
        elif isinstance(jwt_aud, list):
            aud_match = aud in jwt_aud
        azp_match = isinstance(jwt_azp, str) and jwt_azp == aud
        if not (aud_match or azp_match):
            logger.warning(
                "Keycloak JWT audience mismatch: aud=%s, azp=%s, expected=%s",
                jwt_aud,
                jwt_azp,
                aud,
            )
            return None

    iss_claim = payload.get("iss")
    if not isinstance(iss_claim, str) or _norm_iss(iss_claim) != issuer:
        logger.warning("Keycloak JWT iss mismatch")
        return None

    expected_azp = _expected_azp()
    if expected_azp is not None:
        azp = payload.get("azp")
        if azp not in (None, "") and azp != expected_azp:
            logger.warning(
                "Keycloak JWT azp mismatch: got %r want %r",
                azp,
                expected_azp,
            )
            return None

    required = _required_scopes()
    if required:
        scope_claim = payload.get("scope")
        if isinstance(scope_claim, str) and scope_claim.strip():
            present = frozenset(scope_claim.split())
            if not required <= present:
                logger.warning(
                    "Keycloak JWT scope missing required: have %r need %r",
                    sorted(present),
                    sorted(required),
                )
                return None

    return payload
