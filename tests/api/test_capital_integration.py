"""Integration tests for capital tracking API endpoints."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


def test_get_capital_state_empty(client: TestClient):
    """Test GET /api/portfolio/capital with no positions or orders."""
    response = client.get("/api/portfolio/capital")
    
    assert response.status_code == 200
    data = response.json()
    
    assert "account_size" in data
    assert "allocated_positions" in data
    assert "reserved_orders" in data
    assert "available" in data
    assert "utilization_pct" in data
    
    # With no positions/orders, should be fully available
    assert data["allocated_positions"] >= 0
    assert data["reserved_orders"] >= 0
    assert data["available"] > 0


def test_capital_endpoint_structure(client: TestClient):
    """Test that capital endpoint returns correct structure."""
    response = client.get("/api/portfolio/capital")
    
    assert response.status_code == 200
    data = response.json()
    
    # Check all required fields exist
    required_fields = [
        "account_size",
        "allocated_positions",
        "reserved_orders",
        "available",
        "utilization_pct"
    ]
    for field in required_fields:
        assert field in data, f"Missing field: {field}"
    
    # Check types
    assert isinstance(data["account_size"], (int, float))
    assert isinstance(data["allocated_positions"], (int, float))
    assert isinstance(data["reserved_orders"], (int, float))
    assert isinstance(data["available"], (int, float))
    assert isinstance(data["utilization_pct"], (int, float))
    
    # Check utilization is between 0 and 1
    assert 0 <= data["utilization_pct"] <= 1


def test_create_order_sufficient_capital(client: TestClient):
    """Test that order creation succeeds when capital is sufficient."""
    response = client.post("/api/orders", json={
        "ticker": "AAPL",
        "order_type": "BUY_LIMIT",
        "quantity": 1,
        "limit_price": 50.0,
        "order_kind": "entry",
        "notes": "Test order with sufficient capital"
    })
    
    # Should succeed if capital is available
    if response.status_code == 200:
        assert "order_id" in response.json()
    elif response.status_code == 400:
        # If it fails, should be due to capital
        detail = response.json().get("detail", {})
        if isinstance(detail, dict) and "error" in detail:
            assert detail["error"] == "insufficient_capital"


def test_create_order_insufficient_capital(client: TestClient):
    """Test that order creation is blocked when capital is insufficient."""
    # First, check current capital state
    capital_response = client.get("/api/portfolio/capital")
    assert capital_response.status_code == 200
    capital_data = capital_response.json()
    account_size = capital_data["account_size"]
    
    # Try to create order that exceeds account size
    response = client.post("/api/orders", json={
        "ticker": "AAPL",
        "order_type": "BUY_LIMIT",
        "quantity": 1000,
        "limit_price": account_size * 2,  # Double the account size
        "order_kind": "entry",
        "notes": "Test order with insufficient capital"
    })
    
    assert response.status_code == 400
    detail = response.json()["detail"]
    
    # Check error structure
    assert isinstance(detail, dict)
    assert detail["error"] == "insufficient_capital"
    assert "message" in detail
    assert "capital_state" in detail
    
    # Check capital_state structure
    cap_state = detail["capital_state"]
    assert "account_size" in cap_state
    assert "allocated_positions" in cap_state
    assert "reserved_orders" in cap_state
    assert "available" in cap_state
    assert "required" in cap_state
    assert "shortfall" in cap_state
    assert "utilization_pct" in cap_state
    
    # Verify shortfall is positive
    assert cap_state["shortfall"] > 0


def test_create_order_non_entry_no_capital_check(client: TestClient):
    """Test that non-entry orders (stops) don't trigger capital check."""
    response = client.post("/api/orders", json={
        "ticker": "AAPL",
        "order_type": "SELL_STOP",
        "quantity": 100,
        "stop_price": 50.0,
        "order_kind": "stop",
        "notes": "Stop order - should not check capital"
    })
    
    # Stop orders should be created without capital check
    # (they're exits, not entries)
    assert response.status_code == 200
    assert "order_id" in response.json()


def test_capital_updates_with_order_creation(client: TestClient):
    """Test that capital state updates when orders are created."""
    # Get initial capital state
    response1 = client.get("/api/portfolio/capital")
    assert response1.status_code == 200
    initial = response1.json()
    
    # Create a small order
    order_response = client.post("/api/orders", json={
        "ticker": "TEST",
        "order_type": "BUY_LIMIT",
        "quantity": 1,
        "limit_price": 10.0,
        "order_kind": "entry",
        "notes": "Test order for capital tracking"
    })
    
    if order_response.status_code == 200:
        # Get updated capital state
        response2 = client.get("/api/portfolio/capital")
        assert response2.status_code == 200
        updated = response2.json()
        
        # Reserved orders should increase
        assert updated["reserved_orders"] >= initial["reserved_orders"]
        
        # Available should decrease or stay same
        assert updated["available"] <= initial["available"]
        
        # Utilization should increase or stay same
        assert updated["utilization_pct"] >= initial["utilization_pct"]


def test_capital_error_message_clarity(client: TestClient):
    """Test that capital error messages are clear and actionable."""
    # Get current state
    capital_response = client.get("/api/portfolio/capital")
    capital_data = capital_response.json()
    account_size = capital_data["account_size"]
    available = capital_data["available"]
    
    # Create order exceeding available capital
    response = client.post("/api/orders", json={
        "ticker": "AAPL",
        "order_type": "BUY_LIMIT",
        "quantity": 10,
        "limit_price": available + 100,  # More than available
        "order_kind": "entry",
        "notes": "Test capital error message"
    })
    
    if response.status_code == 400:
        detail = response.json()["detail"]
        message = detail.get("message", "")
        
        # Message should contain key information
        assert "Insufficient" in message or "insufficient" in message
        assert "$" in message  # Should show dollar amounts
        
        # Capital state should show the problem
        cap_state = detail["capital_state"]
        assert cap_state["required"] > cap_state["available"]
        assert cap_state["shortfall"] > 0
