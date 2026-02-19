"""Authentication service for CSV-backed user login."""
from __future__ import annotations

import time
from dataclasses import dataclass

from fastapi import HTTPException

from api.models.auth import AuthUser, LoginResponse
from api.repositories.users_repo import UsersRepository
from api.security import create_access_token, decode_access_token, verify_password


@dataclass
class AuthService:
    users_repo: UsersRepository
    jwt_secret: str
    jwt_expire_minutes: int

    def login(self, email: str, password: str) -> LoginResponse:
        user = self.users_repo.get_by_email(email=email)
        if user is None or not user.active:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not verify_password(password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        now = int(time.time())
        expires_in_seconds = self.jwt_expire_minutes * 60
        claims = {
            "sub": user.email,
            "tenant_id": user.tenant_id,
            "role": user.role,
            "active": user.active,
            "iat": now,
            "exp": now + expires_in_seconds,
        }
        token = create_access_token(claims=claims, secret=self.jwt_secret)
        return LoginResponse(
            access_token=token,
            token_type="bearer",
            expires_in_seconds=expires_in_seconds,
            user=AuthUser(
                email=user.email,
                tenant_id=user.tenant_id,
                role=user.role,
                active=user.active,
            ),
        )

    def verify_token(self, token: str) -> AuthUser:
        try:
            claims = decode_access_token(token=token, secret=self.jwt_secret)
        except ValueError as exc:
            raise HTTPException(status_code=401, detail="Invalid or expired token") from exc

        email = str(claims.get("sub", "")).strip().lower()
        tenant_id = str(claims.get("tenant_id", "")).strip()
        role = str(claims.get("role", "member")).strip() or "member"
        active = bool(claims.get("active", True))

        if not email or not tenant_id or not active:
            raise HTTPException(status_code=401, detail="Invalid token claims")

        return AuthUser(
            email=email,
            tenant_id=tenant_id,
            role=role,
            active=active,
        )

