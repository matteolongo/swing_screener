"""Managed auth provider token validation and identity mapping."""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException

from api.models.auth import AuthUser, LoginResponse
from api.repositories.tenant_memberships_repo import TenantMembershipRepository
from api.security import create_access_token, decode_access_token


@dataclass
class ManagedAuthService:
    memberships_repo: TenantMembershipRepository
    app_jwt_secret: str
    app_jwt_expire_minutes: int
    provider: str
    provider_jwt_secret: str
    subject_claim: str
    email_claim: str
    tenant_claim: str
    role_claim: str
    active_claim: str

    def _to_bool(self, value: Any, default: bool = True) -> bool:
        if isinstance(value, bool):
            return value
        if value is None:
            return default
        normalized = str(value).strip().lower()
        if normalized in {"1", "true", "yes", "on"}:
            return True
        if normalized in {"0", "false", "no", "off"}:
            return False
        return default

    def _decode_provider_token(self, token: str) -> dict[str, Any]:
        try:
            return decode_access_token(token=token, secret=self.provider_jwt_secret)
        except ValueError as exc:
            raise HTTPException(status_code=401, detail="Invalid or expired provider token") from exc

    def _resolve_user_from_claims(self, claims: dict[str, Any]) -> AuthUser:
        provider = str(self.provider).strip().lower()
        subject = str(claims.get(self.subject_claim, "")).strip()
        email = str(claims.get(self.email_claim, "")).strip().lower()

        membership = self.memberships_repo.get_by_provider_subject(provider=provider, subject=subject)
        if membership is None and email:
            membership = self.memberships_repo.get_by_email(email=email, provider=provider)

        if membership is not None:
            if not membership.active:
                raise HTTPException(status_code=403, detail="User membership is inactive")
            resolved_email = membership.email or email or subject
            if not resolved_email:
                raise HTTPException(status_code=403, detail="Unable to resolve user identity")
            return AuthUser(
                email=resolved_email,
                tenant_id=membership.tenant_id,
                role=membership.role or "member",
                active=True,
            )

        tenant_id = str(claims.get(self.tenant_claim, "")).strip()
        role = str(claims.get(self.role_claim, "member")).strip() or "member"
        active = self._to_bool(claims.get(self.active_claim), default=True)
        resolved_email = email or subject
        if not resolved_email or not tenant_id or not active:
            raise HTTPException(status_code=403, detail="No tenant membership found for managed identity")

        return AuthUser(
            email=resolved_email,
            tenant_id=tenant_id,
            role=role,
            active=True,
        )

    def authenticate_provider_token(self, provider_token: str) -> AuthUser:
        claims = self._decode_provider_token(provider_token)
        return self._resolve_user_from_claims(claims)

    def exchange_provider_token(self, provider_token: str) -> LoginResponse:
        user = self.authenticate_provider_token(provider_token)
        now = int(time.time())
        expires_in_seconds = self.app_jwt_expire_minutes * 60
        claims = {
            "sub": user.email,
            "tenant_id": user.tenant_id,
            "role": user.role,
            "active": user.active,
            "iat": now,
            "exp": now + expires_in_seconds,
        }
        access_token = create_access_token(claims=claims, secret=self.app_jwt_secret)
        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in_seconds=expires_in_seconds,
            user=user,
        )

