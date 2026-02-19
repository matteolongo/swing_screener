"""Authentication models."""
from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=256)


class AuthUser(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    tenant_id: str = Field(min_length=1, max_length=128)
    role: str = Field(min_length=1, max_length=64)
    active: bool = True


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int
    user: AuthUser


class ManagedTokenExchangeRequest(BaseModel):
    provider_token: str = Field(min_length=1, max_length=8192)
