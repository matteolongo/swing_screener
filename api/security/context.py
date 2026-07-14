"""Role mapping and request session helpers."""
from __future__ import annotations

import secrets
import time
from typing import Mapping

from starlette.requests import Request

from api.security.models import Principal, Role
from api.security.settings import AuthSettings


def resolve_role(
    claims: Mapping[str, object], settings: AuthSettings
) -> Role | None:
    raw = claims.get(settings.oidc_role_claim)
    if isinstance(raw, str):
        values = {raw.strip().lower()} if raw.strip() else set()
    elif isinstance(raw, (list, tuple, set, frozenset)):
        values = {
            value.strip().lower()
            for value in raw
            if isinstance(value, str) and value.strip()
        }
    else:
        return None
    if values & settings.oidc_admin_values:
        return "admin"
    if values & settings.oidc_viewer_values:
        return "viewer"
    return None


def establish_session(
    request: Request,
    principal: Principal,
    settings: AuthSettings,
    now: int | None = None,
) -> str:
    issued_at = int(time.time()) if now is None else now
    csrf_token = secrets.token_urlsafe(32)
    request.session.clear()
    request.session.update(
        {
            "subject": principal.subject,
            "email": principal.email,
            "display_name": principal.display_name,
            "role": principal.role,
            "issued_at": issued_at,
            "expires_at": issued_at + settings.session_ttl_seconds,
            "csrf_token": csrf_token,
        }
    )
    return csrf_token


def _optional_string(value: object) -> str | None:
    if value is None:
        return None
    return value if isinstance(value, str) else None


def principal_from_session(
    request: Request,
    settings: AuthSettings,
    now: int | None = None,
) -> Principal | None:
    if settings.auth_mode == "disabled":
        return Principal(
            subject="local-development",
            email=None,
            display_name="Local Development",
            role="admin",
        )

    session = request.session
    subject = session.get("subject")
    role = session.get("role")
    issued_at = session.get("issued_at")
    expires_at = session.get("expires_at")
    csrf_token = session.get("csrf_token")
    email = session.get("email")
    display_name = session.get("display_name")

    valid = (
        isinstance(subject, str)
        and bool(subject.strip())
        and role in {"viewer", "admin"}
        and isinstance(issued_at, int)
        and not isinstance(issued_at, bool)
        and isinstance(expires_at, int)
        and not isinstance(expires_at, bool)
        and issued_at < expires_at
        and isinstance(csrf_token, str)
        and bool(csrf_token)
        and (email is None or isinstance(email, str))
        and (display_name is None or isinstance(display_name, str))
    )
    current = int(time.time()) if now is None else now
    if not valid or current >= expires_at:
        session.clear()
        return None

    return Principal(
        subject=subject.strip(),
        email=_optional_string(email),
        display_name=_optional_string(display_name),
        role=role,
    )
