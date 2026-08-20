from __future__ import annotations

import pytest

from api.security.settings import AuthSettings, SecurityConfigurationError
from api.services.order_approval_token import (
    ApprovalTokenClaims,
    ApprovalTokenError,
    OrderApprovalTokenSigner,
)


def _claims(**updates) -> ApprovalTokenClaims:
    payload = {
        "ticker": "AAPL",
        "order_type": "BUY_LIMIT",
        "setup_status": "PASS",
        "trigger_status": "PASS",
        "plan_status": "PASS",
        "data_status": "current",
        "data_asof": "2026-07-15",
        "strategy_id": "momentum-v1",
        "strategy_revision": "revision-1",
        "account_currency": "EUR",
        "quote_currency": "USD",
        "account_to_quote_rate": 1.1,
        "target_source": "structural",
        "days_to_earnings": 20,
        "generated_entry": 100.0,
        "generated_stop": 95.0,
        "generated_target": 112.0,
    }
    payload.update(updates)
    return ApprovalTokenClaims(**payload)


def test_token_round_trip_contains_versioned_audit_context():
    signer = OrderApprovalTokenSigner(b"k" * 32, ttl_seconds=100)

    token = signer.issue(_claims(pullback_wait_authorized=True), now=1_000)
    verified = signer.verify(token, now=1_050)

    assert verified.version == 1
    assert verified.ticker == "AAPL"
    assert verified.issued_at == 1_000
    assert verified.expires_at == 1_100
    assert len(verified.token_id) >= 32
    assert len(verified.plan_fingerprint) == 64
    assert verified.pullback_wait_authorized is True


@pytest.mark.parametrize("part", [0, 1])
def test_payload_or_signature_tampering_is_rejected(part: int):
    signer = OrderApprovalTokenSigner(b"k" * 32, ttl_seconds=100)
    pieces = signer.issue(_claims(), now=1_000).split(".")
    pieces[part] = ("A" if pieces[part][0] != "A" else "B") + pieces[part][1:]

    with pytest.raises(ApprovalTokenError, match="invalid"):
        signer.verify(".".join(pieces), now=1_001)


def test_token_expires_at_exact_boundary():
    signer = OrderApprovalTokenSigner(b"k" * 32, ttl_seconds=100)
    token = signer.issue(_claims(), now=1_000)

    with pytest.raises(ApprovalTokenError, match="expired"):
        signer.verify(token, now=1_100)


@pytest.mark.parametrize("token", ["", "only-one-part", "!!.!!", "e30.invalid"])
def test_malformed_token_is_rejected(token: str):
    signer = OrderApprovalTokenSigner(b"k" * 32, ttl_seconds=100)

    with pytest.raises(ApprovalTokenError, match="invalid"):
        signer.verify(token, now=1_000)


def test_production_requires_signing_key_and_bounds_ttl():
    base = {
        "APP_ENV": "production",
        "OIDC_DISCOVERY_URL": "https://id.example/.well-known/openid-configuration",
        "OIDC_CLIENT_ID": "client",
        "OIDC_CLIENT_SECRET": "secret",
        "OIDC_REDIRECT_URI": "https://app.example/api/auth/callback",
        "SESSION_SECRET": "s" * 32,
    }
    missing = AuthSettings.from_env(base)
    with pytest.raises(SecurityConfigurationError, match="ORDER_APPROVAL_SIGNING_KEY"):
        missing.validate_runtime()

    too_long = AuthSettings.from_env(
        {
            **base,
            "ORDER_APPROVAL_SIGNING_KEY": "k" * 32,
            "ORDER_APPROVAL_TTL_SECONDS": "86401",
        }
    )
    with pytest.raises(SecurityConfigurationError, match="ORDER_APPROVAL_TTL_SECONDS"):
        too_long.validate_runtime()


def test_test_mode_derives_a_distinct_approval_key():
    settings = AuthSettings.from_env({"APP_ENV": "test", "AUTH_MODE": "disabled"})

    assert len(settings.order_approval_signing_key) == 32
    assert settings.order_approval_signing_key != settings.session_secret.encode()
