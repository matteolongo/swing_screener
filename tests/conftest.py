"""Pytest configuration and shared fixtures for all tests."""

import pytest


@pytest.fixture(autouse=True)
def reset_intelligence_analyzer_singleton():
    """Reset the module-level _analyzer singleton before/after each test.

    Without this, a stale SymbolAnalyzer instance built by an earlier test
    survives across test boundaries.  Any test that patches SymbolAnalyzer (the
    class) would be ineffective because _get_analyzer() returns the cached
    instance and never calls the patched constructor.
    """
    import api.routers.intelligence as intel_router
    intel_router._analyzer = None
    yield
    intel_router._analyzer = None
