"""Tests for input validation across API models."""
from __future__ import annotations

import math
import pytest
from pydantic import ValidationError

from api.models.portfolio import (
    UpdateStopRequest,
    ClosePositionRequest,
)
from api.models.screener import OrderPreview
from api.routers.screener import OrderPreviewRequest


class TestUpdateStopValidation:
    """Test UpdateStopRequest validation."""

    def test_valid_stop_update(self):
        """Test that valid stop update passes."""
        request = UpdateStopRequest(
            new_stop=148.50,
            reason="Trailing to breakeven"
        )
        assert request.new_stop == 148.50

    def test_stop_zero_fails(self):
        """Test that zero stop price fails."""
        with pytest.raises(ValidationError) as exc_info:
            UpdateStopRequest(new_stop=0)
        assert "greater than 0" in str(exc_info.value)

    def test_stop_negative_fails(self):
        """Test that negative stop fails."""
        with pytest.raises(ValidationError) as exc_info:
            UpdateStopRequest(new_stop=-10.0)
        assert "greater than 0" in str(exc_info.value)

    def test_stop_nan_fails(self):
        """Test that NaN stop fails."""
        with pytest.raises(ValidationError) as exc_info:
            UpdateStopRequest(new_stop=float('nan'))
        # Pydantic gt validator catches this
        assert "UpdateStopRequest" in str(exc_info.value)

    def test_stop_inf_fails(self):
        """Test that Inf stop fails."""
        with pytest.raises(ValidationError) as exc_info:
            UpdateStopRequest(new_stop=float('inf'))
        assert "finite" in str(exc_info.value)

    def test_stop_too_large_fails(self):
        """Test that unreasonably large stop fails."""
        with pytest.raises(ValidationError) as exc_info:
            UpdateStopRequest(new_stop=150000)
        assert "maximum" in str(exc_info.value)


class TestClosePositionValidation:
    """Test ClosePositionRequest validation."""

    def test_valid_close(self):
        """Test that valid close request passes."""
        request = ClosePositionRequest(
            exit_price=155.25,
            fee_eur=1.95,
            reason="Target hit"
        )
        assert request.exit_price == 155.25
        assert request.fee_eur == 1.95

    def test_exit_price_zero_fails(self):
        """Test that zero exit price fails."""
        with pytest.raises(ValidationError) as exc_info:
            ClosePositionRequest(exit_price=0)
        assert "greater than 0" in str(exc_info.value)

    def test_exit_price_nan_fails(self):
        """Test that NaN exit price fails."""
        with pytest.raises(ValidationError) as exc_info:
            ClosePositionRequest(exit_price=float('nan'))
        assert "ClosePositionRequest" in str(exc_info.value)

    def test_fee_negative_fails(self):
        """Test that negative fee fails."""
        with pytest.raises(ValidationError) as exc_info:
            ClosePositionRequest(exit_price=155.25, fee_eur=-0.01)
        assert "greater than or equal to 0" in str(exc_info.value)


class TestOrderPreviewValidation:
    """Test OrderPreview model validation."""

    def test_valid_preview(self):
        """Test that valid preview passes."""
        preview = OrderPreview(
            ticker="MSFT",
            entry_price=400.0,
            stop_price=390.0,
            atr=8.5,
            shares=100,
            position_size_usd=40000,
            risk_usd=1000,
            risk_pct=0.01
        )
        assert preview.ticker == "MSFT"

    def test_risk_pct_zero_fails(self):
        """Test that zero risk_pct fails."""
        with pytest.raises(ValidationError) as exc_info:
            OrderPreview(
                ticker="MSFT",
                entry_price=400.0,
                stop_price=390.0,
                atr=8.5,
                shares=100,
                position_size_usd=40000,
                risk_usd=0,
                risk_pct=0
            )
        assert "between 0 and 1" in str(exc_info.value)

    def test_risk_pct_greater_than_one_fails(self):
        """Test that risk_pct > 1 fails."""
        with pytest.raises(ValidationError) as exc_info:
            OrderPreview(
                ticker="MSFT",
                entry_price=400.0,
                stop_price=390.0,
                atr=8.5,
                shares=100,
                position_size_usd=40000,
                risk_usd=40000,
                risk_pct=1.5
            )
        assert "between 0 and 1" in str(exc_info.value)


class TestOrderPreviewRequestValidation:
    """Test OrderPreviewRequest validation."""

    def test_valid_request(self):
        """Test that valid preview request passes."""
        request = OrderPreviewRequest(
            ticker="NVDA",
            entry_price=850.0,
            stop_price=830.0,
            account_size=100000,
            risk_pct=0.02
        )
        assert request.ticker == "NVDA"
        assert request.entry_price == 850.0

    def test_entry_price_zero_fails(self):
        """Test that zero entry price fails."""
        with pytest.raises(ValidationError) as exc_info:
            OrderPreviewRequest(
                ticker="NVDA",
                entry_price=0,
                stop_price=830.0
            )
        assert "positive" in str(exc_info.value)

    def test_account_size_negative_fails(self):
        """Test that negative account size fails."""
        with pytest.raises(ValidationError) as exc_info:
            OrderPreviewRequest(
                ticker="NVDA",
                entry_price=850.0,
                stop_price=830.0,
                account_size=-10000
            )
        assert "greater than 0" in str(exc_info.value)

    def test_account_size_too_large_fails(self):
        """Test that unreasonably large account size fails."""
        with pytest.raises(ValidationError) as exc_info:
            OrderPreviewRequest(
                ticker="NVDA",
                entry_price=850.0,
                stop_price=830.0,
                account_size=20000000  # > 10M limit
            )
        assert "10000000" in str(exc_info.value)

    def test_risk_pct_too_large_fails(self):
        """Test that risk_pct >= 10% fails."""
        with pytest.raises(ValidationError) as exc_info:
            OrderPreviewRequest(
                ticker="NVDA",
                entry_price=850.0,
                stop_price=830.0,
                risk_pct=0.15  # 15%
            )
        assert "less than 0.1" in str(exc_info.value)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
