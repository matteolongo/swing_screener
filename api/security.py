"""Security helpers for temporary authentication."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any

PBKDF2_SCHEME = "pbkdf2_sha256"
PBKDF2_ITERATIONS = 120_000


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}".encode("ascii"))


def hash_password(password: str, *, salt: bytes | None = None, iterations: int = PBKDF2_ITERATIONS) -> str:
    """Create PBKDF2-SHA256 password hash."""
    if not password:
        raise ValueError("Password cannot be empty")
    salt_bytes = salt if salt is not None else os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_bytes, iterations)
    return f"{PBKDF2_SCHEME}${iterations}${salt_bytes.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify plaintext password against stored hash."""
    if not password or not stored_hash:
        return False
    try:
        scheme, iterations_str, salt_hex, digest_hex = stored_hash.split("$", maxsplit=3)
        if scheme != PBKDF2_SCHEME:
            return False
        iterations = int(iterations_str)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
    except (ValueError, TypeError):
        return False

    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(actual, expected)


def create_access_token(claims: dict[str, Any], secret: str) -> str:
    """Create a signed HS256 token with JSON payload."""
    header = {"alg": "HS256", "typ": "JWT"}
    header_segment = _b64url_encode(json.dumps(header, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    payload_segment = _b64url_encode(json.dumps(claims, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    signing_input = f"{header_segment}.{payload_segment}".encode("ascii")
    signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    signature_segment = _b64url_encode(signature)
    return f"{header_segment}.{payload_segment}.{signature_segment}"


def decode_access_token(token: str, secret: str) -> dict[str, Any]:
    """Decode and validate a signed HS256 token."""
    try:
        header_segment, payload_segment, signature_segment = token.split(".", maxsplit=2)
    except ValueError as exc:
        raise ValueError("Malformed token") from exc

    signing_input = f"{header_segment}.{payload_segment}".encode("ascii")
    expected_signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    provided_signature = _b64url_decode(signature_segment)
    if not hmac.compare_digest(expected_signature, provided_signature):
        raise ValueError("Invalid token signature")

    header = json.loads(_b64url_decode(header_segment).decode("utf-8"))
    if header.get("alg") != "HS256":
        raise ValueError("Unsupported token algorithm")

    payload: dict[str, Any] = json.loads(_b64url_decode(payload_segment).decode("utf-8"))
    exp = payload.get("exp")
    if not isinstance(exp, int) or exp < int(time.time()):
        raise ValueError("Token expired")
    return payload

