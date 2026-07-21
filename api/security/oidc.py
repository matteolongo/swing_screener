"""Provider-neutral OIDC client adapter."""
from __future__ import annotations

from collections.abc import Mapping
from typing import Protocol

from starlette.requests import Request
from starlette.responses import Response

from api.security.settings import AuthSettings


class OIDCClient(Protocol):
    async def authorization_redirect(
        self, request: Request, redirect_uri: str, nonce: str
    ) -> Response: ...

    async def authorize_access_token(
        self, request: Request, nonce: str
    ) -> Mapping[str, object]: ...


class AuthlibOIDCClient:
    """Small adapter that keeps Authlib types out of the application boundary."""

    def __init__(self, settings: AuthSettings) -> None:
        from authlib.integrations.starlette_client import OAuth

        oauth = OAuth()
        oauth.register(
            name="identity",
            server_metadata_url=settings.oidc_discovery_url,
            client_id=settings.oidc_client_id,
            client_secret=settings.oidc_client_secret,
            client_kwargs={"scope": "openid profile email"},
        )
        self._client = oauth.create_client("identity")

    async def authorization_redirect(
        self, request: Request, redirect_uri: str, nonce: str
    ) -> Response:
        if self._client is None:
            raise RuntimeError("OIDC client registration failed")
        return await self._client.authorize_redirect(
            request, redirect_uri, nonce=nonce
        )

    async def authorize_access_token(
        self, request: Request, nonce: str
    ) -> Mapping[str, object]:
        if self._client is None:
            raise RuntimeError("OIDC client registration failed")
        token = await self._client.authorize_access_token(request)
        claims = token.get("userinfo")
        if claims is None:
            claims = await self._client.parse_id_token(token, nonce=nonce)
        if not isinstance(claims, Mapping):
            raise RuntimeError("OIDC provider returned invalid identity claims")
        return claims
