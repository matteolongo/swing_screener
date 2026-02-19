"""Tests for managed auth provider token mapping and exchange."""
from __future__ import annotations

import time
from pathlib import Path

from api.repositories.tenant_memberships_repo import TenantMembershipRepository
from api.security import create_access_token, decode_access_token
from api.services.managed_auth_service import ManagedAuthService


def _write_memberships_csv(path: Path) -> None:
    path.write_text(
        "provider,subject,email,tenant_id,role,active\n"
        "oidc,user-123,friend@example.com,tenant-demo,member,true\n",
        encoding="utf-8",
    )


def _create_provider_token(secret: str, claims: dict[str, object]) -> str:
    now = int(time.time())
    payload = {
        "iat": now,
        "exp": now + 3600,
        **claims,
    }
    return create_access_token(payload, secret=secret)


def test_exchange_provider_token_with_membership_mapping(tmp_path: Path):
    memberships = tmp_path / "tenant_memberships.csv"
    _write_memberships_csv(memberships)

    service = ManagedAuthService(
        memberships_repo=TenantMembershipRepository(memberships),
        app_jwt_secret="app-secret",
        app_jwt_expire_minutes=10,
        provider="oidc",
        provider_jwt_secret="provider-secret",
        subject_claim="sub",
        email_claim="email",
        tenant_claim="tenant_id",
        role_claim="role",
        active_claim="active",
    )

    provider_token = _create_provider_token(
        "provider-secret",
        {"sub": "user-123", "email": "friend@example.com"},
    )
    response = service.exchange_provider_token(provider_token)

    assert response.user.email == "friend@example.com"
    assert response.user.tenant_id == "tenant-demo"
    app_claims = decode_access_token(response.access_token, secret="app-secret")
    assert app_claims["tenant_id"] == "tenant-demo"
    assert app_claims["role"] == "member"


def test_provider_claim_fallback_without_membership(tmp_path: Path):
    memberships = tmp_path / "tenant_memberships.csv"
    memberships.write_text("provider,subject,email,tenant_id,role,active\n", encoding="utf-8")
    service = ManagedAuthService(
        memberships_repo=TenantMembershipRepository(memberships),
        app_jwt_secret="app-secret",
        app_jwt_expire_minutes=10,
        provider="oidc",
        provider_jwt_secret="provider-secret",
        subject_claim="sub",
        email_claim="email",
        tenant_claim="tenant_id",
        role_claim="role",
        active_claim="active",
    )

    provider_token = _create_provider_token(
        "provider-secret",
        {
            "sub": "user-999",
            "email": "unknown@example.com",
            "tenant_id": "tenant-claims",
            "role": "admin",
            "active": True,
        },
    )
    user = service.authenticate_provider_token(provider_token)
    assert user.tenant_id == "tenant-claims"
    assert user.role == "admin"

