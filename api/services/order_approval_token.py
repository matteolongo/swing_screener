"""Versioned HMAC approval tokens for actionable screener candidates."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import math
import time
import uuid
from typing import Mapping

from pydantic import BaseModel, ConfigDict, field_validator


class ApprovalTokenError(ValueError):
    """Raised when an order approval token cannot be trusted."""


class ApprovalTokenClaims(BaseModel):
    model_config = ConfigDict(frozen=True)

    ticker: str
    order_type: str
    setup_status: str
    trigger_status: str
    plan_status: str
    data_status: str
    data_asof: str
    strategy_id: str
    strategy_revision: str
    account_currency: str
    quote_currency: str
    account_to_quote_rate: float
    target_source: str
    days_to_earnings: int
    generated_entry: float
    generated_stop: float
    generated_target: float

    @field_validator(
        "account_to_quote_rate",
        "generated_entry",
        "generated_stop",
        "generated_target",
    )
    @classmethod
    def validate_positive_finite(cls, value: float) -> float:
        if not math.isfinite(value) or value <= 0:
            raise ValueError("approval numeric values must be finite and positive")
        return value


class VerifiedApprovalToken(ApprovalTokenClaims):
    version: int
    token_id: str
    issued_at: int
    expires_at: int
    plan_fingerprint: str


def _canonical(value: dict) -> bytes:
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=True
    ).encode("utf-8")


def strategy_revision(strategy: Mapping[str, object]) -> str:
    """Return a stable revision that changes whenever strategy policy changes."""
    return hashlib.sha256(_canonical(dict(strategy))).hexdigest()


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode((value + padding).encode("ascii"))


class OrderApprovalTokenSigner:
    def __init__(self, key: bytes, *, ttl_seconds: int = 28_800) -> None:
        if len(key) < 32:
            raise ValueError("approval signing key must contain at least 32 bytes")
        if ttl_seconds <= 0:
            raise ValueError("approval token TTL must be positive")
        self._key = key
        self._ttl_seconds = ttl_seconds

    def issue(self, claims: ApprovalTokenClaims, now: int | None = None) -> str:
        issued_at = int(time.time()) if now is None else now
        plan = {
            "ticker": claims.ticker.upper(),
            "order_type": claims.order_type.upper(),
            "strategy_id": claims.strategy_id,
            "entry": claims.generated_entry,
            "stop": claims.generated_stop,
            "target": claims.generated_target,
        }
        payload = {
            **claims.model_dump(),
            "ticker": claims.ticker.upper(),
            "order_type": claims.order_type.upper(),
            "account_currency": claims.account_currency.upper(),
            "quote_currency": claims.quote_currency.upper(),
            "version": 1,
            "token_id": uuid.uuid4().hex,
            "issued_at": issued_at,
            "expires_at": issued_at + self._ttl_seconds,
            "plan_fingerprint": hashlib.sha256(_canonical(plan)).hexdigest(),
        }
        encoded = _encode(_canonical(payload))
        signature = _encode(
            hmac.new(self._key, encoded.encode("ascii"), hashlib.sha256).digest()
        )
        return f"{encoded}.{signature}"

    def verify(self, token: str, now: int | None = None) -> VerifiedApprovalToken:
        try:
            encoded, supplied = token.split(".", 1)
            if not encoded or not supplied or "." in supplied:
                raise ValueError
            expected = _encode(
                hmac.new(self._key, encoded.encode("ascii"), hashlib.sha256).digest()
            )
            if not hmac.compare_digest(expected, supplied):
                raise ValueError
            raw = json.loads(_decode(encoded))
            verified = VerifiedApprovalToken.model_validate(raw)
            if verified.version != 1:
                raise ValueError
        except Exception as exc:
            raise ApprovalTokenError("approval token is invalid") from exc
        current = int(time.time()) if now is None else now
        if current >= verified.expires_at:
            raise ApprovalTokenError("approval token is expired")
        return verified
