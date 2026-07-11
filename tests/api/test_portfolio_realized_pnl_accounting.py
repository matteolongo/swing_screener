from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from api.models.portfolio import ClosePositionRequest, PartialCloseEvent, PartialCloseRequest
from api.repositories.positions_repo import PositionsRepository
from api.services.portfolio.read import PortfolioReadService
from api.services.portfolio.write import PortfolioWriteService


class _FakePricing:
    def __init__(self, *, current_prices: dict[str, float] | None = None, eurusd_rate: float = 1.0) -> None:
        self.current_prices = current_prices or {}
        self.eurusd_rate = eurusd_rate

    @staticmethod
    def _fallback_price(position: dict) -> float:
        if position.get("exit_price") is not None:
            return float(position["exit_price"])
        if position.get("current_price") is not None:
            return float(position["current_price"])
        return float(position.get("entry_price", 0.0))

    def _attach_live_prices(self, positions: list[dict]) -> tuple[dict[str, float], frozenset[str]]:
        return dict(self.current_prices), frozenset(self.current_prices)

    def _fetch_live_quote(self, ticker: str) -> float | None:
        return self.current_prices.get(ticker)

    def _fetch_last_prices(self, tickers: list[str]) -> dict[str, float]:
        return {ticker: self.current_prices[ticker] for ticker in tickers if ticker in self.current_prices}

    def _eurusd_rate(self) -> float:
        return self.eurusd_rate


class _ConfigRepo:
    def __init__(self, *, account_currency: str = "EUR") -> None:
        self._config = SimpleNamespace(
            risk=SimpleNamespace(
                account_currency=account_currency,
                max_concentration_pct=60.0,
            )
        )

    def get(self):
        return self._config


def _positions_file(tmp_path: Path, positions: list[dict]) -> Path:
    path = tmp_path / "positions.json"
    path.write_text(json.dumps({"asof": "2026-01-01", "positions": positions}))
    return path


def _read_service(
    tmp_path: Path,
    positions: list[dict],
    *,
    current_prices: dict[str, float] | None = None,
    eurusd_rate: float = 1.0,
) -> PortfolioReadService:
    return PortfolioReadService(
        PositionsRepository(_positions_file(tmp_path, positions)),
        _FakePricing(current_prices=current_prices, eurusd_rate=eurusd_rate),
        _ConfigRepo(account_currency="EUR"),
    )


def test_optional_exit_fx_fields_are_part_of_close_and_partial_contract() -> None:
    close = ClosePositionRequest(exit_price=130.0, fee_eur=3.0, exit_fx_rate=1.30)
    partial = PartialCloseRequest(shares_closed=4, price=120.0, fee_eur=1.0, fx_rate=1.28)
    event = PartialCloseEvent(
        date="2026-01-10",
        shares_closed=4,
        price=120.0,
        r_at_close=2.0,
        fee_eur=1.0,
        fx_rate=1.28,
    )

    assert close.exit_fx_rate == 1.30
    assert partial.fx_rate == 1.28
    assert event.fx_rate == 1.28


def test_close_and_partial_close_persist_optional_fx_rates(tmp_path: Path) -> None:
    positions_path = _positions_file(
        tmp_path,
        [
            {
                "position_id": "POS-AAPL-1",
                "ticker": "AAPL",
                "status": "open",
                "entry_date": "2026-01-01",
                "entry_price": 100.0,
                "stop_price": 90.0,
                "shares": 10,
                "initial_risk": 10.0,
            },
            {
                "position_id": "POS-ASML-1",
                "ticker": "ASML.AS",
                "status": "open",
                "entry_date": "2026-01-01",
                "entry_price": 100.0,
                "stop_price": 90.0,
                "shares": 10,
                "initial_risk": 10.0,
            },
        ],
    )
    service = PortfolioWriteService(PositionsRepository(positions_path), provider=None)

    service.partial_close_position(
        "POS-ASML-1",
        PartialCloseRequest(shares_closed=4, price=120.0, fee_eur=1.0, fx_rate=1.28),
    )
    service.close_position(
        "POS-AAPL-1",
        ClosePositionRequest(exit_price=130.0, fee_eur=3.0, exit_fx_rate=1.30),
    )

    positions = {
        position["position_id"]: position
        for position in json.loads(positions_path.read_text())["positions"]
    }
    assert positions["POS-ASML-1"]["partial_closes"][0]["fx_rate"] == 1.28
    assert positions["POS-AAPL-1"]["exit_fx_rate"] == 1.30


def test_realized_pnl_deducts_entry_and_exit_fees_for_closed_eur_position(tmp_path: Path) -> None:
    service = _read_service(
        tmp_path,
        [
            {
                "position_id": "POS-ASML-1",
                "ticker": "ASML.AS",
                "status": "closed",
                "entry_date": "2026-01-01",
                "entry_price": 100.0,
                "stop_price": 90.0,
                "shares": 10,
                "initial_risk": 10.0,
                "entry_fee_eur": 2.0,
                "exit_price": 110.0,
                "exit_date": "2026-01-20",
                "exit_fee_eur": 3.0,
            }
        ],
    )

    summary = service.get_portfolio_summary(account_size=1_000.0)

    assert summary.realized_pnl == pytest.approx(95.0, abs=0.01)
    assert summary.effective_account_size == pytest.approx(1_095.0, abs=0.01)


def test_partial_close_realizes_proportional_entry_fee_and_open_metrics_keep_remaining_fee(
    tmp_path: Path,
) -> None:
    service = _read_service(
        tmp_path,
        [
            {
                "position_id": "POS-ASML-1",
                "ticker": "ASML.AS",
                "status": "open",
                "entry_date": "2026-01-01",
                "entry_price": 100.0,
                "stop_price": 90.0,
                "shares": 6,
                "initial_risk": 10.0,
                "entry_fee_eur": 10.0,
                "current_price": 130.0,
                "partial_closes": [
                    {
                        "date": "2026-01-10",
                        "shares_closed": 4,
                        "price": 120.0,
                        "r_at_close": 2.0,
                        "fee_eur": 1.0,
                    }
                ],
            }
        ],
        current_prices={"ASML.AS": 130.0},
    )

    summary = service.get_portfolio_summary(account_size=1_000.0)
    metrics = service.get_position_metrics("POS-ASML-1")

    assert summary.realized_pnl == pytest.approx(75.0, abs=0.01)
    assert summary.total_pnl == pytest.approx(174.0, abs=0.01)
    assert metrics.pnl == pytest.approx(174.0, abs=0.01)
    assert metrics.fees_eur == pytest.approx(6.0, abs=0.01)


def test_closed_position_after_partial_close_deducts_entry_fee_once(tmp_path: Path) -> None:
    service = _read_service(
        tmp_path,
        [
            {
                "position_id": "POS-ASML-1",
                "ticker": "ASML.AS",
                "status": "closed",
                "entry_date": "2026-01-01",
                "entry_price": 100.0,
                "stop_price": 90.0,
                "shares": 6,
                "initial_risk": 10.0,
                "entry_fee_eur": 10.0,
                "exit_price": 130.0,
                "exit_date": "2026-01-20",
                "exit_fee_eur": 2.0,
                "partial_closes": [
                    {
                        "date": "2026-01-10",
                        "shares_closed": 4,
                        "price": 120.0,
                        "r_at_close": 2.0,
                        "fee_eur": 1.0,
                    }
                ],
            }
        ],
    )

    summary = service.get_portfolio_summary(account_size=1_000.0)

    assert summary.realized_pnl == pytest.approx(247.0, abs=0.01)


def test_realized_pnl_uses_recorded_entry_and_exit_fx_for_usd_positions(tmp_path: Path) -> None:
    service = _read_service(
        tmp_path,
        [
            {
                "position_id": "POS-AAPL-1",
                "ticker": "AAPL",
                "status": "closed",
                "entry_date": "2026-01-01",
                "entry_price": 100.0,
                "stop_price": 90.0,
                "shares": 10,
                "initial_risk": 10.0,
                "entry_fee_eur": 5.0,
                "entry_fx_rate": 1.25,
                "exit_price": 130.0,
                "exit_date": "2026-01-20",
                "exit_fee_eur": 3.0,
                "exit_fx_rate": 1.30,
            }
        ],
        eurusd_rate=1.40,
    )

    summary = service.get_portfolio_summary(account_size=1_000.0)

    assert summary.realized_pnl == pytest.approx(192.0, abs=0.01)
