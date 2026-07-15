"""OIDC login and application-session endpoints."""
from __future__ import annotations

import logging
import secrets

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, RedirectResponse, Response

from api.security.context import (
    establish_session,
    principal_from_session,
    resolve_role,
)
from api.security.models import (
    AuthSessionResponse,
    AuthUserResponse,
    Principal,
)
from api.security.oidc import AuthlibOIDCClient, OIDCClient
from api.security.settings import AuthSettings, get_auth_settings

logger = logging.getLogger(__name__)
router = APIRouter()


def _settings(request: Request) -> AuthSettings:
    return getattr(request.app.state, "auth_settings", None) or get_auth_settings()


def get_oidc_client(request: Request) -> OIDCClient:
    client = getattr(request.app.state, "oidc_client", None)
    if client is None:
        client = AuthlibOIDCClient(_settings(request))
        request.app.state.oidc_client = client
    return client


def _error(status_code: int, detail: str, code: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"detail": detail, "code": code},
    )


@router.get("/login")
async def login(
    request: Request, oidc: OIDCClient = Depends(get_oidc_client)
) -> Response:
    settings = _settings(request)
    if settings.auth_mode == "disabled":
        return RedirectResponse("/", status_code=303)
    request.session.clear()
    nonce = secrets.token_urlsafe(32)
    request.session["oidc_nonce"] = nonce
    return await oidc.authorization_redirect(
        request, settings.oidc_redirect_uri, nonce
    )


@router.get("/callback")
async def callback(
    request: Request, oidc: OIDCClient = Depends(get_oidc_client)
) -> Response:
    settings = _settings(request)
    nonce = request.session.pop("oidc_nonce", None)
    if not isinstance(nonce, str) or not nonce:
        request.session.clear()
        return _error(401, "The login flow is invalid or expired.", "OIDC_FLOW_INVALID")
    try:
        claims = await oidc.authorize_access_token(request, nonce)
    except Exception:
        request.session.clear()
        logger.exception("OIDC callback validation failed")
        return _error(
            401,
            "Identity provider authentication failed.",
            "OIDC_AUTHENTICATION_FAILED",
        )

    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject.strip():
        request.session.clear()
        return _error(401, "The identity is incomplete.", "OIDC_IDENTITY_INVALID")
    role = resolve_role(claims, settings)
    if role is None:
        request.session.clear()
        return _error(403, "The identity has no application role.", "OIDC_ROLE_DENIED")

    email = claims.get("email")
    display_name = claims.get("name") or claims.get("preferred_username")
    principal = Principal(
        subject=subject.strip(),
        email=email if isinstance(email, str) else None,
        display_name=display_name if isinstance(display_name, str) else None,
        role=role,
    )
    establish_session(request, principal, settings)
    return RedirectResponse("/", status_code=303)


@router.get(
    "/session",
    response_model=AuthSessionResponse,
)
async def session(request: Request) -> AuthSessionResponse | JSONResponse:
    settings = _settings(request)
    principal = principal_from_session(request, settings)
    if principal is None:
        return JSONResponse({"authenticated": False})
    csrf = request.session.get("csrf_token") if settings.auth_mode == "oidc" else None
    issued_at = request.session.get("issued_at")
    expires_at = request.session.get("expires_at")
    return AuthSessionResponse(
        authenticated=True,
        user=AuthUserResponse(
            subject=principal.subject,
            email=principal.email,
            display_name=principal.display_name,
        ),
        role=principal.role,
        csrf_token=csrf if isinstance(csrf, str) else None,
        issued_at=issued_at if isinstance(issued_at, int) else None,
        expires_at=expires_at if isinstance(expires_at, int) else None,
    )


@router.post("/logout", status_code=204)
async def logout(request: Request) -> Response:
    request.session.clear()
    return Response(status_code=204)
