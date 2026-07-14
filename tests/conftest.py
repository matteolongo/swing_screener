"""Pytest configuration and shared fixtures for all tests."""

import os
import sys

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("AUTH_MODE", "disabled")

import pytest


@pytest.fixture(autouse=True)
def reset_intelligence_analyzer_singleton():
    """Reset the module-level _analyzer singleton before/after each test.

    Without this, a stale SymbolAnalyzer instance built by an earlier test
    survives across test boundaries.  Any test that patches SymbolAnalyzer (the
    class) would be ineffective because _get_analyzer() returns the cached
    instance and never calls the patched constructor.
    """
    intel_router = sys.modules.get("api.routers.intelligence")
    if intel_router is not None:
        intel_router._analyzer = None
    yield
    intel_router = sys.modules.get("api.routers.intelligence")
    if intel_router is not None:
        intel_router._analyzer = None
