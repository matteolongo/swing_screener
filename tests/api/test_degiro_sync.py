"""Tests for _fetch_holdings in degiro_sync."""
from __future__ import annotations

import sys
from types import ModuleType
from unittest.mock import MagicMock

import pytest


def _install_fake_degiro_connector() -> None:
    """Install a minimal fake degiro_connector so the import in _fetch_holdings succeeds."""
    if "degiro_connector" in sys.modules:
        return
    pkg = ModuleType("degiro_connector")
    trading = ModuleType("degiro_connector.trading")
    models = ModuleType("degiro_connector.trading.models")
    account = ModuleType("degiro_connector.trading.models.account")

    class UpdateOption:
        PORTFOLIO = "PORTFOLIO"

    class UpdateRequest:
        def __init__(self, *, option, last_updated):
            self.option = option
            self.last_updated = last_updated

    account.UpdateOption = UpdateOption
    account.UpdateRequest = UpdateRequest

    sys.modules["degiro_connector"] = pkg
    sys.modules["degiro_connector.trading"] = trading
    sys.modules["degiro_connector.trading.models"] = models
    sys.modules["degiro_connector.trading.models.account"] = account


_install_fake_degiro_connector()

from api.services.portfolio.degiro_sync import _fetch_holdings  # noqa: E402


def _make_api(portfolio_value: list) -> MagicMock:
    api = MagicMock()
    api.get_update.return_value = {"portfolio": {"value": portfolio_value}}
    return api


def _make_item(fields: list[dict]) -> dict:
    return {"value": fields}


NORMAL_ITEM = _make_item([
    {"name": "id", "value": "12345"},
    {"name": "size", "value": 10},
    {"name": "positionType", "value": "PRODUCT"},
    {"name": "breakEvenPrice", "value": 42.5},
    {"name": "averageFxRate", "value": 1.08},
    {"name": "currency", "value": "EUR"},
])


def test_avg_cost_comes_from_break_even_price_not_average_fx_rate():
    api = _make_api([NORMAL_ITEM])
    holdings = _fetch_holdings(api)
    assert len(holdings) == 1
    assert holdings[0].avg_cost == 42.5


def test_negative_size_is_skipped():
    item = _make_item([
        {"name": "id", "value": "99999"},
        {"name": "size", "value": -5},
        {"name": "positionType", "value": "PRODUCT"},
        {"name": "breakEvenPrice", "value": 10.0},
    ])
    api = _make_api([item])
    holdings = _fetch_holdings(api)
    assert holdings == []


def test_zero_size_is_skipped():
    item = _make_item([
        {"name": "id", "value": "99999"},
        {"name": "size", "value": 0},
        {"name": "positionType", "value": "PRODUCT"},
    ])
    api = _make_api([item])
    holdings = _fetch_holdings(api)
    assert holdings == []


def test_entry_missing_name_key_does_not_crash():
    item = _make_item([
        {"name": "id", "value": "12345"},
        {"name": "size", "value": 10},
        {"name": "positionType", "value": "PRODUCT"},
        {"value": "orphaned_value_without_name"},  # no "name" key
        {"name": "breakEvenPrice", "value": 55.0},
    ])
    api = _make_api([item])
    holdings = _fetch_holdings(api)
    assert len(holdings) == 1
    assert holdings[0].product_id == "12345"
    assert holdings[0].avg_cost == 55.0


def test_non_product_position_type_skipped():
    item = _make_item([
        {"name": "id", "value": "88888"},
        {"name": "size", "value": 3},
        {"name": "positionType", "value": "CASH"},
        {"name": "breakEvenPrice", "value": 1.0},
    ])
    api = _make_api([item])
    holdings = _fetch_holdings(api)
    assert holdings == []


def test_empty_portfolio_returns_empty():
    api = _make_api([])
    assert _fetch_holdings(api) == []


def test_no_update_returns_empty():
    api = MagicMock()
    api.get_update.return_value = None
    assert _fetch_holdings(api) == []
