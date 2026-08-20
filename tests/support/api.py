"""Helpers for safely installing FastAPI dependency overrides in tests."""

from __future__ import annotations

from collections.abc import Callable, Iterator, Mapping
from contextlib import contextmanager

from fastapi import FastAPI
from fastapi.testclient import TestClient


@contextmanager
def dependency_overrides(
    app: FastAPI,
    overrides: Mapping[Callable[..., object], Callable[[], object]],
) -> Iterator[None]:
    """Temporarily apply overrides and restore the exact prior mapping."""
    previous = dict(app.dependency_overrides)
    app.dependency_overrides.update(overrides)
    try:
        yield
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)


def api_client(app: FastAPI) -> TestClient:
    """Create the standard synchronous client used by API tests."""
    return TestClient(app)


__all__ = ["api_client", "dependency_overrides"]
