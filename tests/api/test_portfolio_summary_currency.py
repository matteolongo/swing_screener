from types import SimpleNamespace

import pytest

import api.services.portfolio.read as portfolio_read
from api.services.portfolio.read import PortfolioReadService


class _FakePositionsRepo:
    def __init__(self, positions: list[dict]) -> None:
        self._positions = positions

    def list_positions(self, status: str | None = None):
        if status is None:
            return list(self._positions), "2026-07-08"
        return [p for p in self._positions if p.get("status") == status], "2026-07-08"

    def get_position(self, position_id: str):
        return next(
            (p for p in self._positions if p.get("position_id") == position_id),
            None,
        )


class _FakePricing:
    def __init__(self, current_prices: dict[str, float], eurusd_rate: float) -> None:
        self._current_prices = current_prices
        self._rate = eurusd_rate

    def _attach_live_prices(self, positions: list[dict]):
        return dict(self._current_prices), frozenset(self._current_prices)

    def _eurusd_rate(self) -> float:
        return self._rate

    @staticmethod
    def _fallback_price(position: dict) -> float:
        return float(position.get("current_price") or position.get("entry_price"))


class _FakeConfigRepo:
    def __init__(self, account_currency: str = "EUR") -> None:
        self.account_currency = account_currency

    def get(self):
        return SimpleNamespace(
            risk=SimpleNamespace(
                account_currency=self.account_currency,
                max_concentration_pct=60.0,
            )
        )


def test_portfolio_summary_aggregates_open_money_in_account_currency(monkeypatch):
    positions = [
        {
            "position_id": "POS-AAPL",
            "ticker": "AAPL",
            "status": "open",
            "entry_date": "2026-06-01",
            "entry_price": 100.0,
            "stop_price": 90.0,
            "shares": 10,
            "initial_risk": 10.0,
        },
        {
            "position_id": "POS-BESI",
            "ticker": "BESI.AS",
            "status": "open",
            "entry_date": "2026-06-01",
            "entry_price": 100.0,
            "stop_price": 95.0,
            "shares": 2,
            "initial_risk": 5.0,
        },
    ]
    monkeypatch.setattr(
        portfolio_read,
        "detect_currency",
        lambda ticker: {"AAPL": "USD", "BESI.AS": "EUR"}[ticker],
    )

    service = PortfolioReadService(
        _FakePositionsRepo(positions),
        _FakePricing({"AAPL": 120.0, "BESI.AS": 110.0}, eurusd_rate=1.2),
        _FakeConfigRepo(),
    )

    summary = service.get_portfolio_summary(account_size=5000.0, account_size_mode="base")

    assert summary.total_value == pytest.approx(1220.0, abs=0.01)
    assert summary.total_cost_basis == pytest.approx(1033.33, abs=0.01)
    assert summary.total_pnl == pytest.approx(186.67, abs=0.01)
    assert summary.open_risk == pytest.approx(93.33, abs=0.01)
    assert summary.open_risk_percent == pytest.approx(1.87, abs=0.01)
    assert summary.available_capital == pytest.approx(3780.0, abs=0.01)
    assert summary.largest_position_value == pytest.approx(1000.0, abs=0.01)

    risk_by_country = {item.country: item.risk_amount for item in summary.concentration}
    assert risk_by_country["US"] == pytest.approx(83.33, abs=0.01)
    assert risk_by_country["NL"] == pytest.approx(10.0, abs=0.01)


def test_portfolio_summary_converts_eur_positions_for_usd_account(monkeypatch):
    positions = [
        {
            "position_id": "POS-BESI",
            "ticker": "BESI.AS",
            "status": "open",
            "entry_date": "2026-06-01",
            "entry_price": 100.0,
            "stop_price": 95.0,
            "shares": 2,
            "initial_risk": 5.0,
        },
    ]
    monkeypatch.setattr(portfolio_read, "detect_currency", lambda ticker: "EUR")

    service = PortfolioReadService(
        _FakePositionsRepo(positions),
        _FakePricing({"BESI.AS": 110.0}, eurusd_rate=1.2),
        _FakeConfigRepo(account_currency="USD"),
    )

    summary = service.get_portfolio_summary(account_size=5000.0, account_size_mode="base")

    assert summary.total_value == pytest.approx(264.0, abs=0.01)
    assert summary.total_cost_basis == pytest.approx(240.0, abs=0.01)
    assert summary.total_pnl == pytest.approx(24.0, abs=0.01)
    assert summary.open_risk == pytest.approx(12.0, abs=0.01)
    assert summary.open_risk_percent == pytest.approx(0.24, abs=0.01)
    assert summary.available_capital == pytest.approx(4736.0, abs=0.01)
    assert summary.largest_position_value == pytest.approx(264.0, abs=0.01)

    risk_by_country = {item.country: item.risk_amount for item in summary.concentration}
    assert risk_by_country["NL"] == pytest.approx(12.0, abs=0.01)
