"""Tests for health check and monitoring endpoints."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


class TestHealthCheck:
    """Test health check endpoint."""

    def test_health_endpoint_exists(self):
        """Test that /health endpoint is accessible."""
        response = client.get("/health")
        
        assert response.status_code in [200, 503]  # healthy or unhealthy
        data = response.json()
        
        assert "status" in data
        assert data["status"] in ["healthy", "degraded", "unhealthy"]
        assert "checks" in data
        assert "metrics" in data

    def test_health_includes_file_checks(self):
        """Test that health check includes file access checks."""
        response = client.get("/health")
        data = response.json()
        
        assert "checks" in data
        assert "files" in data["checks"]
        assert "data_directory" in data["checks"]

    def test_health_includes_metrics(self):
        """Test that health check includes metrics."""
        response = client.get("/health")
        data = response.json()
        
        assert "metrics" in data
        assert "uptime_seconds" in data["metrics"]
        # Other metrics might be 0 if no events occurred
        assert "lock_contention_total" in data["metrics"]
        assert "validation_failures_total" in data["metrics"]


class TestMetrics:
    """Test metrics endpoint."""

    def test_metrics_endpoint_exists(self):
        """Test that /metrics endpoint is accessible."""
        response = client.get("/metrics")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "uptime_seconds" in data
        assert isinstance(data["uptime_seconds"], (int, float))
        assert data["uptime_seconds"] >= 0

    def test_metrics_includes_counters(self):
        """Test that metrics includes all counter fields."""
        response = client.get("/metrics")
        data = response.json()
        
        assert "lock_contention_total" in data
        assert "validation_failures_total" in data
        
        # Should be integers
        assert isinstance(data["lock_contention_total"], int)
        assert isinstance(data["validation_failures_total"], int)

    @pytest.mark.skip(reason="TODO: implement using a request that triggers ValidationError and increments validation_failures_total")
    def test_metrics_validation_failure_increments(self):
        """Test that validation failures are counted."""
        # NOTE: The global exception handler tracks Pydantic ValidationError
        # exceptions and increments the validation_failures_total metric.
        # This test is currently skipped until we define a specific endpoint
        # and payload to reliably trigger such a validation error.
        pass


class TestRootEndpoint:
    """Test root endpoint includes health link."""

    def test_root_includes_health_link(self):
        """Test that root endpoint mentions /health."""
        response = client.get("/")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "health" in data
        assert data["health"] == "/health"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
