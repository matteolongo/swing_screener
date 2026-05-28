"""Tests for input validation across API models."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from api.models.portfolio import (
    UpdateStopRequest,
    ClosePositionRequest,
)

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


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
