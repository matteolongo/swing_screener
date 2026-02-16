"""Tests for capital tracking and allocation management."""
from __future__ import annotations

import pytest

from swing_screener.portfolio.capital import (
    compute_capital_state,
    check_capital_available,
    CapitalState,
)
from swing_screener.portfolio.state import Position
from swing_screener.execution.orders import Order


class TestComputeCapitalState:
    """Tests for compute_capital_state function."""
    
    def test_no_positions_no_orders(self):
        """Test with empty positions and orders."""
        state = compute_capital_state([], [], account_size=10000.0)
        
        assert state.account_size == 10000.0
        assert state.allocated_positions == 0.0
        assert state.reserved_orders == 0.0
        assert state.available == 10000.0
        assert state.utilization_pct == 0.0
    
    def test_open_positions_only(self):
        """Test with open positions but no pending orders."""
        positions = [
            Position(
                ticker="AAPL",
                status="open",
                entry_date="2026-01-15",
                entry_price=150.0,
                stop_price=145.0,
                shares=10,
            ),
            Position(
                ticker="MSFT",
                status="open",
                entry_date="2026-01-16",
                entry_price=400.0,
                stop_price=390.0,
                shares=5,
            ),
        ]
        
        state = compute_capital_state(positions, [], account_size=10000.0)
        
        # 10 * 150 + 5 * 400 = 1500 + 2000 = 3500
        assert state.allocated_positions == 3500.0
        assert state.reserved_orders == 0.0
        assert state.available == 6500.0
        assert state.utilization_pct == 0.35
    
    def test_closed_positions_ignored(self):
        """Test that closed positions are not counted."""
        positions = [
            Position(
                ticker="AAPL",
                status="open",
                entry_date="2026-01-15",
                entry_price=150.0,
                stop_price=145.0,
                shares=10,
            ),
            Position(
                ticker="GOOGL",
                status="closed",
                entry_date="2026-01-10",
                entry_price=140.0,
                stop_price=135.0,
                shares=3,
                exit_date="2026-01-20",
                exit_price=145.0,
            ),
        ]
        
        state = compute_capital_state(positions, [], account_size=10000.0)
        
        # Only open position: 10 * 150 = 1500
        assert state.allocated_positions == 1500.0
        assert state.available == 8500.0
    
    def test_pending_entry_orders_only(self):
        """Test with pending entry orders but no positions."""
        orders = [
            Order(
                order_id="ORD-1",
                ticker="TSLA",
                status="pending",
                order_type="BUY_LIMIT",
                quantity=2,
                limit_price=200.0,
                order_kind="entry",
            ),
            Order(
                order_id="ORD-2",
                ticker="NVDA",
                status="pending",
                order_type="BUY_LIMIT",
                quantity=5,
                limit_price=500.0,
                order_kind="entry",
            ),
        ]
        
        state = compute_capital_state([], orders, account_size=10000.0)
        
        # 2 * 200 + 5 * 500 = 400 + 2500 = 2900
        assert state.allocated_positions == 0.0
        assert state.reserved_orders == 2900.0
        assert state.available == 7100.0
        assert state.utilization_pct == 0.29
    
    def test_filled_orders_ignored(self):
        """Test that filled orders are not counted as reserved."""
        orders = [
            Order(
                order_id="ORD-1",
                ticker="TSLA",
                status="pending",
                order_type="BUY_LIMIT",
                quantity=2,
                limit_price=200.0,
                order_kind="entry",
            ),
            Order(
                order_id="ORD-2",
                ticker="NVDA",
                status="filled",
                order_type="BUY_LIMIT",
                quantity=10,
                limit_price=500.0,
                order_kind="entry",
                filled_date="2026-01-15",
                entry_price=495.0,
            ),
        ]
        
        state = compute_capital_state([], orders, account_size=10000.0)
        
        # Only pending order: 2 * 200 = 400
        assert state.reserved_orders == 400.0
        assert state.available == 9600.0
    
    def test_stop_orders_ignored(self):
        """Test that stop orders (exit orders) are not counted."""
        orders = [
            Order(
                order_id="ORD-1",
                ticker="TSLA",
                status="pending",
                order_type="BUY_LIMIT",
                quantity=2,
                limit_price=200.0,
                order_kind="entry",
            ),
            Order(
                order_id="ORD-2",
                ticker="AAPL",
                status="pending",
                order_type="SELL_STOP",
                quantity=10,
                stop_price=145.0,
                order_kind="stop",
            ),
        ]
        
        state = compute_capital_state([], orders, account_size=10000.0)
        
        # Only entry order: 2 * 200 = 400 (stop order not counted)
        assert state.reserved_orders == 400.0
        assert state.available == 9600.0
    
    def test_positions_and_orders_combined(self):
        """Test with both open positions and pending orders."""
        positions = [
            Position(
                ticker="AAPL",
                status="open",
                entry_date="2026-01-15",
                entry_price=150.0,
                stop_price=145.0,
                shares=10,
            ),
        ]
        
        orders = [
            Order(
                order_id="ORD-1",
                ticker="TSLA",
                status="pending",
                order_type="BUY_LIMIT",
                quantity=2,
                limit_price=200.0,
                order_kind="entry",
            ),
        ]
        
        state = compute_capital_state(positions, orders, account_size=10000.0)
        
        # Position: 10 * 150 = 1500
        # Order: 2 * 200 = 400
        # Total: 1900
        assert state.allocated_positions == 1500.0
        assert state.reserved_orders == 400.0
        assert state.available == 8600.0
        assert state.utilization_pct == 0.19
    
    def test_high_utilization(self):
        """Test with high capital utilization."""
        positions = [
            Position(
                ticker="AAPL",
                status="open",
                entry_date="2026-01-15",
                entry_price=150.0,
                stop_price=145.0,
                shares=30,  # 4500
            ),
        ]
        
        orders = [
            Order(
                order_id="ORD-1",
                ticker="TSLA",
                status="pending",
                order_type="BUY_LIMIT",
                quantity=20,
                limit_price=200.0,
                order_kind="entry",  # 4000
            ),
        ]
        
        state = compute_capital_state(positions, orders, account_size=10000.0)
        
        # Total: 4500 + 4000 = 8500 (85%)
        assert state.allocated_positions == 4500.0
        assert state.reserved_orders == 4000.0
        assert state.available == 1500.0
        assert state.utilization_pct == 0.85
    
    def test_zero_account_size(self):
        """Test with zero account size (edge case)."""
        state = compute_capital_state([], [], account_size=0.0)
        
        assert state.account_size == 0.0
        assert state.utilization_pct == 0.0
    
    def test_rounding(self):
        """Test that values are properly rounded."""
        positions = [
            Position(
                ticker="AAPL",
                status="open",
                entry_date="2026-01-15",
                entry_price=150.333,
                stop_price=145.0,
                shares=3,
            ),
        ]
        
        state = compute_capital_state(positions, [], account_size=10000.0)
        
        # 3 * 150.333 = 450.999, should round to 451.0
        assert state.allocated_positions == 451.0
        assert state.available == 9549.0


class TestCheckCapitalAvailable:
    """Tests for check_capital_available function."""
    
    def test_sufficient_capital(self):
        """Test when sufficient capital is available."""
        state = CapitalState(
            account_size=10000.0,
            allocated_positions=3000.0,
            reserved_orders=2000.0,
            available=5000.0,
            utilization_pct=0.50
        )
        
        check = check_capital_available(state, required_capital=3000.0)
        
        assert check.is_available is True
        assert check.required == 3000.0
        assert check.available == 5000.0
        assert check.shortfall == 0.0
        assert "Sufficient" in check.reason
    
    def test_insufficient_capital(self):
        """Test when capital is insufficient."""
        state = CapitalState(
            account_size=10000.0,
            allocated_positions=5000.0,
            reserved_orders=4000.0,
            available=1000.0,
            utilization_pct=0.90
        )
        
        check = check_capital_available(state, required_capital=2000.0)
        
        assert check.is_available is False
        assert check.required == 2000.0
        assert check.available == 1000.0
        assert check.shortfall == 1000.0
        assert "Insufficient" in check.reason
        assert "shortfall" in check.reason.lower()
    
    def test_exact_capital(self):
        """Test when required capital exactly matches available."""
        state = CapitalState(
            account_size=10000.0,
            allocated_positions=3000.0,
            reserved_orders=2000.0,
            available=5000.0,
            utilization_pct=0.50
        )
        
        check = check_capital_available(state, required_capital=5000.0)
        
        assert check.is_available is True
        assert check.shortfall == 0.0
    
    def test_zero_required(self):
        """Test with zero required capital."""
        state = CapitalState(
            account_size=10000.0,
            allocated_positions=3000.0,
            reserved_orders=2000.0,
            available=5000.0,
            utilization_pct=0.50
        )
        
        check = check_capital_available(state, required_capital=0.0)
        
        assert check.is_available is True
        assert check.shortfall == 0.0
    
    def test_zero_available(self):
        """Test when no capital is available."""
        state = CapitalState(
            account_size=10000.0,
            allocated_positions=6000.0,
            reserved_orders=4000.0,
            available=0.0,
            utilization_pct=1.0
        )
        
        check = check_capital_available(state, required_capital=100.0)
        
        assert check.is_available is False
        assert check.shortfall == 100.0
    
    def test_rounding(self):
        """Test that check values are properly rounded."""
        state = CapitalState(
            account_size=10000.0,
            allocated_positions=3000.333,
            reserved_orders=2000.444,
            available=4999.223,
            utilization_pct=0.50
        )
        
        check = check_capital_available(state, required_capital=3000.555)
        
        assert check.required == 3000.56  # Rounded to 2 decimals
        assert check.available == 4999.22
