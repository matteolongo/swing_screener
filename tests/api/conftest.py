"""Pytest configuration for API integration tests."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from api.main import app


@pytest.fixture
def client():
    """Create FastAPI test client."""
    return TestClient(app)