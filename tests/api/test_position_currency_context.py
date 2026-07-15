from __future__ import annotations

from types import SimpleNamespace

import pytest

from api.models.portfolio import CreatePositionRequest
from api.services.portfolio.write import PortfolioWriteService
from swing_screener.errors import ValidationError


class _Positions:
    def __init__(self) -> None:
        self.data = {"positions": [], "asof": "2026-07-15"}

    def update(self, modify):
        self.data = modify(self.data)
        return self.data


class _Config:
    def get(self):
        return SimpleNamespace(risk=SimpleNamespace(account_currency="EUR"))


def _request(**updates) -> CreatePositionRequest:
    values = {
        "ticker": "AAPL",
        "entry_price": 200,
        "stop_price": 190,
        "shares": 2,
        "entry_date": "2026-07-15",
        "quote_currency": "USD",
        "entry_fx_rate": 1.1,
    }
    values.update(updates)
    return CreatePositionRequest(**values)


def test_manual_position_persists_complete_currency_context():
    service = PortfolioWriteService(_Positions(), config_repo=_Config())

    position = service.create_position(_request())

    assert position.quote_currency == "USD"
    assert position.account_currency == "EUR"
    assert position.entry_fx_rate == 1.1


def test_manual_cross_currency_position_requires_entry_fx():
    service = PortfolioWriteService(_Positions(), config_repo=_Config())

    with pytest.raises(ValidationError, match="FX"):
        service.create_position(_request(entry_fx_rate=None))
