"""Security domain and response models."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel

Role = Literal["viewer", "admin"]


@dataclass(frozen=True)
class Principal:
    subject: str
    email: str | None
    display_name: str | None
    role: Role


class AuthUserResponse(BaseModel):
    subject: str
    email: str | None = None
    display_name: str | None = None


class AuthSessionResponse(BaseModel):
    authenticated: bool
    user: AuthUserResponse | None = None
    role: Role | None = None
    csrf_token: str | None = None
    issued_at: int | None = None
    expires_at: int | None = None
