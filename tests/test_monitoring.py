"""Tests for health check and monitoring endpoints."""
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import app
from api.monitoring import HealthChecker

client = TestClient(app)


class TestHealthChecker:
    """Test state-file health classification without touching runtime data."""

    def test_file_access_is_healthy_and_does_not_create_missing_state_files(self, tmp_path: Path):
        positions_file = tmp_path / "positions.json"
        orders_file = tmp_path / "orders.json"

        result = HealthChecker.check_file_access(positions_file, orders_file)

        assert result == {
            "status": "healthy",
            "positions_file": "ok",
            "orders_file": "ok",
            "issues": None,
        }
        assert not positions_file.exists()
        assert not orders_file.exists()

    def test_invalid_json_is_degraded(self, tmp_path: Path):
        positions_file = tmp_path / "positions.json"
        orders_file = tmp_path / "orders.json"
        positions_file.write_text("not-json", encoding="utf-8")
        orders_file.write_text("{}", encoding="utf-8")

        result = HealthChecker.check_file_access(positions_file, orders_file)

        assert result["status"] == "degraded"
        assert result["positions_file"] == "warning"
        assert result["orders_file"] == "ok"
        assert result["issues"] == [f"{positions_file}: invalid JSON"]

    def test_permission_failure_is_unhealthy(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        positions_file = tmp_path / "positions.json"
        orders_file = tmp_path / "orders.json"
        positions_file.write_text("{}", encoding="utf-8")
        orders_file.write_text("{}", encoding="utf-8")
        original_read_text = Path.read_text

        def read_text(path: Path, *args, **kwargs):
            if path == positions_file:
                raise PermissionError("denied")
            return original_read_text(path, *args, **kwargs)

        monkeypatch.setattr(Path, "read_text", read_text)

        result = HealthChecker.check_file_access(positions_file, orders_file)

        assert result["status"] == "unhealthy"
        assert result["positions_file"] == "error"
        assert result["orders_file"] == "ok"
        assert result["issues"] == [f"{positions_file}: permission denied"]


class TestHealthCheck:
    """Test health check endpoint."""

    def test_health_endpoint_exists(self):
        response = client.get("/health")

        assert response.status_code in [200, 503]  # healthy/degraded or unhealthy
        data = response.json()

        assert "status" in data
        assert data["status"] in ["healthy", "degraded", "unhealthy"]
        assert "checks" in data
        assert "metrics" in data

    def test_health_includes_file_checks(self):
        response = client.get("/health")
        data = response.json()

        assert "checks" in data
        assert "files" in data["checks"]
        assert "data_directory" in data["checks"]

    def test_health_includes_metrics(self):
        response = client.get("/health")
        data = response.json()

        assert "metrics" in data
        assert "uptime_seconds" in data["metrics"]
        assert "lock_contention_total" in data["metrics"]
        assert "validation_failures_total" in data["metrics"]

    def test_unhealthy_file_check_returns_service_unavailable(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(
            HealthChecker,
            "check_file_access",
            lambda: {
                "status": "unhealthy",
                "positions_file": "error",
                "orders_file": "ok",
                "issues": ["positions: permission denied"],
            },
        )
        monkeypatch.setattr(HealthChecker, "check_data_directory", lambda: {"status": "ok"})

        response = client.get("/health")

        assert response.status_code == 503
        assert response.json()["status"] == "unhealthy"

    def test_warning_file_check_returns_degraded_success(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(
            HealthChecker,
            "check_file_access",
            lambda: {
                "status": "degraded",
                "positions_file": "warning",
                "orders_file": "ok",
                "issues": ["positions: invalid JSON"],
            },
        )
        monkeypatch.setattr(HealthChecker, "check_data_directory", lambda: {"status": "ok"})

        response = client.get("/health")

        assert response.status_code == 200
        assert response.json()["status"] == "degraded"


class TestMetrics:
    """Test metrics endpoint."""

    def test_metrics_endpoint_exists(self):
        response = client.get("/metrics")

        assert response.status_code == 200
        data = response.json()

        assert "uptime_seconds" in data
        assert isinstance(data["uptime_seconds"], (int, float))
        assert data["uptime_seconds"] >= 0

    def test_metrics_includes_counters(self):
        response = client.get("/metrics")
        data = response.json()

        assert "lock_contention_total" in data
        assert "validation_failures_total" in data
        assert isinstance(data["lock_contention_total"], int)
        assert isinstance(data["validation_failures_total"], int)

    @pytest.mark.skip(reason="TODO: increment metrics for FastAPI RequestValidationError responses")
    def test_metrics_validation_failure_increments(self):
        """Test that request validation failures are counted."""
        pass


class TestRootEndpoint:
    """Test root endpoints include health metadata for API clients."""

    def test_api_root_includes_health_link(self):
        response = client.get("/api")

        assert response.status_code == 200
        data = response.json()

        assert "health" in data
        assert data["health"] == "/health"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
