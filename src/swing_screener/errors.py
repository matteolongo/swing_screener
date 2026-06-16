"""Framework-free domain errors.

Services raise these instead of fastapi.HTTPException. The FastAPI adapter
(api/main.py) maps each subclass to its HTTP status; non-HTTP callers (the CLI)
catch DomainError and render it themselves. Nothing here imports a web framework.
"""
from __future__ import annotations


class DomainError(Exception):
    """Base for all expected, caller-facing domain failures."""

    http_status: int = 500

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class NotFoundError(DomainError):
    http_status = 404


class ValidationError(DomainError):
    http_status = 400


class ConflictError(DomainError):
    http_status = 409


class UnprocessableError(DomainError):
    http_status = 422


class ServiceError(DomainError):
    http_status = 500


class UpstreamError(DomainError):
    """A dependency (data provider, external API) failed."""

    http_status = 502


class ServiceUnavailableError(DomainError):
    """A transient condition (e.g. lock contention) prevents serving the request."""

    http_status = 503
