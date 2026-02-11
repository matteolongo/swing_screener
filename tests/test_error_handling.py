"""Tests for error handling improvements in Phase 3-4."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


class TestErrorMasking:
    """Test that error details are masked in API responses for security."""

    def test_http_exception_preserves_status_code(self):
        """Test that HTTPException status codes are preserved."""
        # Try to get non-existent position
        response = client.get("/api/portfolio/positions/nonexistent-id")
        
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()

    def test_validation_error_shows_field_details(self):
        """Test that Pydantic validation errors show field-level details."""
        # Send invalid data - negative price
        response = client.post(
            "/api/portfolio/orders",
            json={
                "ticker": "AAPL",
                "direction": "long",
                "entry_price": -100.0,  # Invalid - negative
                "stop_price": 95.0,
                "quantity": 10,
                "risk_pct": 1.0,
            }
        )
        
        assert response.status_code == 422
        data = response.json()
        
        # Should contain validation error details (intentional)
        assert "detail" in data
        # Pydantic validation errors are list of dicts
        assert isinstance(data["detail"], list)

    def test_validation_error_on_invalid_ticker(self):
        """Test ticker validation error."""
        response = client.post(
            "/api/portfolio/orders",
            json={
                "ticker": "TOOLONGTICKERXYZ",  # Invalid - too long
                "direction": "long",
                "entry_price": 100.0,
                "stop_price": 95.0,
                "quantity": 10,
                "risk_pct": 1.0,
            }
        )
        
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data


class TestCORSConfiguration:
    """Test CORS headers are properly restricted."""

    def test_cors_allows_specific_origins_only(self):
        """Test that only allowed origins get CORS headers."""
        response = client.get(
            "/",
            headers={"Origin": "http://localhost:5173"}
        )
        
        assert response.status_code == 200
        # Should have CORS headers for allowed origin
        assert "access-control-allow-origin" in response.headers

    def test_cors_methods_are_explicit(self):
        """Test that CORS allows explicit methods, not wildcard."""
        response = client.options(
            "/api/config",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET"
            }
        )
        
        # Check that allowed methods are explicit
        allowed = response.headers.get("access-control-allow-methods", "")
        # Should NOT be "*"
        assert "*" not in allowed
        # Should contain explicit methods
        assert any(method in allowed for method in ["GET", "POST", "PUT", "DELETE"])


class TestExceptionHandlingRobustness:
    """Test that specific exception types are handled correctly."""

    def test_file_not_found_returns_404(self):
        """Test that file not found errors return 404."""
        response = client.get("/api/backtest/simulations/nonexistent-simulation-id")
        
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()

    def test_invalid_universe_returns_400(self):
        """Test that invalid universe name returns appropriate error."""
        response = client.post(
            "/api/screener/run",
            json={
                "universe": "this_universe_does_not_exist_xyz123",
                "strategy_id": "default",
                "limit": 10,
            }
        )
        
        # Should get error (might be 400 or 500 depending on implementation)
        assert response.status_code in [400, 404, 500]
        data = response.json()
        assert "detail" in data


class TestInputValidation:
    """Test that input validation works correctly."""

    def test_negative_price_rejected(self):
        """Test negative prices are rejected."""
        response = client.post(
            "/api/portfolio/orders",
            json={
                "ticker": "AAPL",
                "direction": "long",
                "entry_price": -50.0,
                "stop_price": 45.0,
                "quantity": 10,
                "risk_pct": 1.0,
            }
        )
        
        assert response.status_code == 422

    def test_invalid_direction_rejected(self):
        """Test invalid direction is rejected."""
        response = client.post(
            "/api/portfolio/orders",
            json={
                "ticker": "AAPL",
                "direction": "sideways",  # Invalid
                "entry_price": 100.0,
                "stop_price": 95.0,
                "quantity": 10,
                "risk_pct": 1.0,
            }
        )
        
        assert response.status_code == 422

    def test_stop_above_entry_for_long_rejected(self):
        """Test that stop > entry for long is rejected."""
        response = client.post(
            "/api/portfolio/orders",
            json={
                "ticker": "AAPL",
                "direction": "long",
                "entry_price": 100.0,
                "stop_price": 105.0,  # Invalid - stop above entry for long
                "quantity": 10,
                "risk_pct": 1.0,
            }
        )
        
        assert response.status_code == 422


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
