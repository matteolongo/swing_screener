"""Per-request correlation id for logs and responses."""
from __future__ import annotations

import logging
import re
from contextvars import ContextVar
from uuid import uuid4

from starlette.types import ASGIApp, Message, Receive, Scope, Send

REQUEST_ID_HEADER = "X-Request-ID"
_HEADER_KEY = REQUEST_ID_HEADER.lower().encode("latin-1")
_VALID_INBOUND_ID = re.compile(r"[A-Za-z0-9._-]{1,64}")

_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)


def current_request_id() -> str | None:
    """Return the id of the request being served, or None outside a request."""
    return _request_id.get()


class RequestIdLogFilter(logging.Filter):
    """Stamp every record with ``request_id`` so the log format can include it."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = _request_id.get() or "-"
        return True


class RequestContextMiddleware:
    """Assign each HTTP request an id and echo it in the response headers.

    A well-formed inbound ``X-Request-ID`` (e.g. from a proxy) is reused so
    logs can be joined across hops; anything else is replaced.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        inbound = next(
            (value.decode("latin-1") for key, value in scope.get("headers", []) if key == _HEADER_KEY),
            "",
        )
        request_id = inbound if _VALID_INBOUND_ID.fullmatch(inbound) else uuid4().hex
        token = _request_id.set(request_id)

        async def send_with_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = [
                    (key, value)
                    for key, value in message.get("headers", [])
                    if key.lower() != _HEADER_KEY
                ]
                headers.append((_HEADER_KEY, request_id.encode("latin-1")))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            _request_id.reset(token)
