"""Read-model: list/get positions and portfolio summary."""
from __future__ import annotations

import datetime as dt
import logging
from typing import Optional

from swing_screener.errors import NotFoundError
from swing_screener.data.currency import detect_currency
from swing_screener.portfolio.state import ManageConfig as ManageStateConfig
from swing_screener.portfolio.metrics import (
    calculate_current_position_value,
    calculate_per_share_risk,
    calculate_pnl,
    calculate_r_now,
    calculate_total_position_value,
)

from api.models.portfolio import (
    ConcentrationGroup,
    PartialCloseEvent,
    Position,
    PositionMetrics,
    PositionWithMetrics,
    PositionsWithMetricsResponse,
    PortfolioSummary,
)
from api.repositories.config_repo import ConfigRepository
from api.repositories.positions_repo import PositionsRepository
from api.services.portfolio._helpers import to_state_position
from api.services.portfolio.pricing import PositionPricingService

logger = logging.getLogger(__name__)


def _country_from_ticker(ticker: str) -> str:
    suffix_map = {
        ".AS": "NL",
        ".PA": "FR",
        ".DE": "DE",
        ".MC": "ES",
        ".MI": "IT",
        ".ST": "SE",
        ".L": "UK",
        ".BR": "BE",
        ".LS": "PT",
        ".HE": "FI",
        ".CO": "DK",
        ".OL": "NO",
    }
    upper = ticker.strip().upper()
    for suffix, country in suffix_map.items():
        if upper.endswith(suffix):
            return country
    return "US"


def _compute_r_fx_adjusted(
    entry_price: float,
    stop_price: float,
    current_price: float,
    entry_eurusd: float,
    current_eurusd: float,
) -> Optional[float]:
    """R adjusted for EURUSD movement. EURUSD = USD per 1 EUR (e.g. 1.10)."""
    if entry_eurusd <= 0 or current_eurusd <= 0:
        return None
    per_share_risk = entry_price - stop_price
    if per_share_risk <= 0:
        return None
    entry_eur = entry_price / entry_eurusd
    current_eur = current_price / current_eurusd
    stop_eur = stop_price / entry_eurusd
    per_share_risk_eur = entry_eur - stop_eur
    if per_share_risk_eur <= 0:
        return None
    return (current_eur - entry_eur) / per_share_risk_eur


class PortfolioReadService:
    """Read-model: positions list, metrics, portfolio summary."""

    def __init__(
        self,
        positions_repo: PositionsRepository,
        pricing: PositionPricingService,
        config_repo: ConfigRepository,
    ) -> None:
        self._positions_repo = positions_repo
        self._pricing = pricing
        self._config_repo = config_repo

    def _build_position_with_metrics(
        self,
        position: dict,
        current_prices: dict[str, float],
        eurusd_rate: float,
        account_currency: str = "EUR",
        *,
        time_stop_days: int | None = None,
        time_stop_min_r: float | None = None,
    ) -> PositionWithMetrics:
        state_position = to_state_position(position)
        ticker = state_position.ticker.upper()
        live_price = current_prices.get(ticker)
        current_price_for_metrics = live_price if live_price is not None else self._pricing._fallback_price(position)
        per_share_risk = calculate_per_share_risk(state_position)
        entry_fee_eur = float(position.get("entry_fee_eur") or 0.0)
        fee_for_pnl = entry_fee_eur * eurusd_rate if detect_currency(ticker) == "USD" else entry_fee_eur
        pnl = calculate_pnl(state_position.entry_price, current_price_for_metrics, state_position.shares) - fee_for_pnl
        entry_value = calculate_total_position_value(state_position.entry_price, state_position.shares)
        pnl_percent = (pnl / entry_value * 100.0) if entry_value > 0 else 0.0

        payload = dict(position)
        if state_position.status == "open" and live_price is not None:
            payload["current_price"] = live_price

        if live_price is not None:
            price_source = "live"
        elif position.get("current_price") is not None:
            price_source = "cached"
        else:
            price_source = "entry"

        current_risk_per_share = float(state_position.entry_price - state_position.stop_price)
        r_uses_initial_risk = (
            state_position.initial_risk is not None
            and float(state_position.initial_risk) > 0
            and abs(float(state_position.initial_risk) - current_risk_per_share) > 0.001
        )

        days_open = self._days_open(state_position.entry_date)
        r_now = calculate_r_now(state_position, current_price_for_metrics, fee_deduction=fee_for_pnl)
        manage_defaults = ManageStateConfig()
        stale_days = int(time_stop_days or manage_defaults.time_stop_days)
        min_progress_r = float(time_stop_min_r if time_stop_min_r is not None else manage_defaults.time_stop_min_r)
        time_stop_warning = (
            state_position.status == "open"
            and days_open >= stale_days
            and r_now < min_progress_r
        )

        position_currency = detect_currency(ticker)
        r_fx_adjusted: Optional[float] = None
        entry_fx_rate_raw = position.get("entry_fx_rate")
        if (
            position_currency != account_currency
            and position_currency == "USD"
            and account_currency == "EUR"
            and entry_fx_rate_raw
            and eurusd_rate > 0
        ):
            r_fx_adjusted = _compute_r_fx_adjusted(
                entry_price=state_position.entry_price,
                stop_price=state_position.stop_price,
                current_price=current_price_for_metrics,
                entry_eurusd=float(entry_fx_rate_raw),
                current_eurusd=eurusd_rate,
            )

        return PositionWithMetrics(
            **payload,
            pnl=pnl,
            fees_eur=entry_fee_eur,
            pnl_percent=pnl_percent,
            r_now=r_now,
            entry_value=entry_value,
            current_value=calculate_current_position_value(current_price_for_metrics, state_position.shares),
            per_share_risk=per_share_risk,
            total_risk=per_share_risk * state_position.shares,
            days_open=days_open,
            time_stop_warning=time_stop_warning,
            r_fx_adjusted=r_fx_adjusted,
            price_source=price_source,
            r_uses_initial_risk=r_uses_initial_risk,
        )

    @staticmethod
    def _days_open(entry_date: str) -> int:
        try:
            entry_dt = dt.date.fromisoformat(str(entry_date))
        except ValueError:
            return 0
        return max((dt.date.today() - entry_dt).days, 0)

    def list_positions(
        self,
        status: Optional[str] = None,
        *,
        time_stop_days: int | None = None,
        time_stop_min_r: float | None = None,
    ) -> PositionsWithMetricsResponse:
        positions, asof = self._positions_repo.list_positions(status=status)
        current_prices = self._pricing._attach_live_prices(positions)
        has_usd_positions = any(
            detect_currency(str(position.get("ticker", "")).upper()) == "USD"
            for position in positions
        )
        eurusd_rate = self._pricing._eurusd_rate() if has_usd_positions else 1.0
        account_currency = getattr(self._config_repo.get().risk, "account_currency", "EUR")

        positions_with_metrics = [
            self._build_position_with_metrics(
                position,
                current_prices,
                eurusd_rate,
                account_currency,
                time_stop_days=time_stop_days,
                time_stop_min_r=time_stop_min_r,
            )
            for position in positions
        ]
        return PositionsWithMetricsResponse(positions=positions_with_metrics, asof=asof)

    def get_position(self, position_id: str) -> Position:
        position = self._positions_repo.get_position(position_id)
        if position is None:
            raise NotFoundError(f"Position not found: {position_id}")
        return Position(**position)

    def get_position_metrics(self, position_id: str) -> PositionMetrics:
        position = self._positions_repo.get_position(position_id)
        if position is None:
            raise NotFoundError(f"Position not found: {position_id}")

        ticker = str(position.get("ticker", "")).upper()
        current_price = self._pricing._fallback_price(position)

        if position.get("status") == "open" and ticker:
            try:
                current_price = self._pricing._fetch_last_prices([ticker]).get(ticker, current_price)
            except Exception as exc:
                logger.warning("Failed to fetch current price for %s metrics: %s", ticker, exc)

        state_position = to_state_position(position)
        entry_fee_eur = float(position.get("entry_fee_eur") or 0.0)
        eurusd_rate = self._pricing._eurusd_rate() if detect_currency(ticker) == "USD" and entry_fee_eur else 1.0
        fee_for_pnl = entry_fee_eur * eurusd_rate if detect_currency(ticker) == "USD" else entry_fee_eur
        pnl = calculate_pnl(state_position.entry_price, current_price, state_position.shares) - fee_for_pnl
        per_share_risk = calculate_per_share_risk(state_position)
        entry_value = calculate_total_position_value(state_position.entry_price, state_position.shares)
        pnl_percent = (pnl / entry_value * 100.0) if entry_value > 0 else 0.0

        raw_events = position.get("partial_closes") or []
        partial_close_events = [
            PartialCloseEvent(
                date=e["date"],
                shares_closed=int(e["shares_closed"]),
                price=float(e["price"]),
                r_at_close=float(e["r_at_close"]),
                fee_eur=e.get("fee_eur"),
            )
            for e in raw_events
        ]

        blended_r: Optional[float] = None
        if partial_close_events:
            total_shares = sum(e.shares_closed for e in partial_close_events)
            blended_r = sum(e.shares_closed * e.r_at_close for e in partial_close_events) / total_shares

        account_currency = getattr(self._config_repo.get().risk, "account_currency", "EUR")
        position_currency = detect_currency(ticker)
        r_fx_adjusted: Optional[float] = None
        entry_fx_rate_raw = position.get("entry_fx_rate")
        if (
            position_currency != account_currency
            and position_currency == "USD"
            and account_currency == "EUR"
            and entry_fx_rate_raw
        ):
            current_eurusd = self._pricing._eurusd_rate()
            r_fx_adjusted = _compute_r_fx_adjusted(
                entry_price=state_position.entry_price,
                stop_price=state_position.stop_price,
                current_price=current_price,
                entry_eurusd=float(entry_fx_rate_raw),
                current_eurusd=current_eurusd,
            )

        current_risk_per_share_metrics = float(state_position.entry_price - state_position.stop_price)
        r_uses_initial_risk_metrics = (
            state_position.initial_risk is not None
            and float(state_position.initial_risk) > 0
            and abs(float(state_position.initial_risk) - current_risk_per_share_metrics) > 0.001
        )

        return PositionMetrics(
            ticker=ticker,
            pnl=pnl,
            fees_eur=entry_fee_eur,
            pnl_percent=pnl_percent,
            r_now=calculate_r_now(state_position, current_price, fee_deduction=fee_for_pnl),
            entry_value=entry_value,
            current_value=calculate_current_position_value(current_price, state_position.shares),
            per_share_risk=per_share_risk,
            total_risk=per_share_risk * state_position.shares,
            partial_closes=partial_close_events,
            blended_r=blended_r,
            r_fx_adjusted=r_fx_adjusted,
            price_source="live",
            r_uses_initial_risk=r_uses_initial_risk_metrics,
        )

    def _realized_pnl(self) -> float:
        positions, _ = self._positions_repo.list_positions(status=None)
        realized_pnl = 0.0
        for position in positions:
            if position.get("status") != "closed" or position.get("exit_price") is None:
                continue

            realized_pnl += (
                (float(position.get("exit_price")) - float(position.get("entry_price", 0.0)))
                * int(position.get("shares", 0))
            )
            exit_fee_eur = position.get("exit_fee_eur")
            if exit_fee_eur is not None:
                realized_pnl -= abs(float(exit_fee_eur))
        return realized_pnl

    def get_portfolio_summary(self, account_size: float, account_size_mode: str = "equity") -> PortfolioSummary:
        realized_pnl = self._realized_pnl()
        effective_account_size = account_size + realized_pnl if account_size_mode == "equity" else account_size
        positions_response = self.list_positions(status="open")
        positions = positions_response.positions
        if not positions:
            return PortfolioSummary(
                total_positions=0,
                total_value=0.0,
                total_cost_basis=0.0,
                total_pnl=0.0,
                total_fees_eur=0.0,
                total_pnl_percent=0.0,
                open_risk=0.0,
                open_risk_percent=0.0,
                account_size=account_size,
                available_capital=effective_account_size,
                largest_position_value=0.0,
                largest_position_ticker="",
                best_performer_ticker="",
                best_performer_pnl_pct=0.0,
                worst_performer_ticker="",
                worst_performer_pnl_pct=0.0,
                avg_r_now=0.0,
                positions_profitable=0,
                positions_losing=0,
                win_rate=0.0,
                concentration=[],
                realized_pnl=realized_pnl,
                effective_account_size=effective_account_size,
            )

        total_value = 0.0
        total_cost_basis = 0.0
        total_pnl = 0.0
        total_fees_eur = 0.0
        open_risk = 0.0
        largest_position_value = 0.0
        largest_position_ticker = ""
        best_performer_ticker = ""
        best_performer_pnl_pct = float("-inf")
        worst_performer_ticker = ""
        worst_performer_pnl_pct = float("inf")
        total_r_now = 0.0
        r_count = 0
        positions_profitable = 0
        positions_losing = 0

        for position in positions:
            total_cost_basis += position.entry_value
            total_value += position.current_value
            total_pnl += position.pnl
            total_fees_eur += position.fees_eur

            if position.total_risk > 0:
                open_risk += position.total_risk
                total_r_now += position.r_now
                r_count += 1

            if position.current_value > largest_position_value:
                largest_position_value = position.current_value
                largest_position_ticker = position.ticker

            if position.pnl_percent > best_performer_pnl_pct:
                best_performer_pnl_pct = position.pnl_percent
                best_performer_ticker = position.ticker

            if position.pnl_percent < worst_performer_pnl_pct:
                worst_performer_pnl_pct = position.pnl_percent
                worst_performer_ticker = position.ticker

            if position.pnl > 0:
                positions_profitable += 1
            elif position.pnl < 0:
                positions_losing += 1

        total_pnl_percent = (total_pnl / total_cost_basis * 100.0) if total_cost_basis > 0 else 0.0
        open_risk_percent = (open_risk / effective_account_size * 100.0) if effective_account_size > 0 else 0.0
        avg_r_now = (total_r_now / r_count) if r_count > 0 else 0.0
        win_rate = (positions_profitable / len(positions) * 100.0) if positions else 0.0
        concentration = self._concentration_groups(positions, open_risk)

        return PortfolioSummary(
            total_positions=len(positions),
            total_value=total_value,
            total_cost_basis=total_cost_basis,
            total_pnl=total_pnl,
            total_fees_eur=total_fees_eur,
            total_pnl_percent=total_pnl_percent,
            open_risk=open_risk,
            open_risk_percent=open_risk_percent,
            account_size=account_size,
            available_capital=effective_account_size - total_value,
            largest_position_value=largest_position_value,
            largest_position_ticker=largest_position_ticker,
            best_performer_ticker=best_performer_ticker,
            best_performer_pnl_pct=best_performer_pnl_pct if best_performer_ticker else 0.0,
            worst_performer_ticker=worst_performer_ticker,
            worst_performer_pnl_pct=worst_performer_pnl_pct if worst_performer_ticker else 0.0,
            avg_r_now=avg_r_now,
            positions_profitable=positions_profitable,
            positions_losing=positions_losing,
            win_rate=win_rate,
            concentration=concentration,
            realized_pnl=realized_pnl,
            effective_account_size=effective_account_size,
        )

    def _concentration_groups(
        self,
        positions: list[PositionWithMetrics],
        open_risk: float,
    ) -> list[ConcentrationGroup]:
        country_risk: dict[str, float] = {}
        country_count: dict[str, int] = {}
        for position in positions:
            if position.total_risk <= 0:
                continue
            country = _country_from_ticker(position.ticker)
            country_risk[country] = country_risk.get(country, 0.0) + position.total_risk
            country_count[country] = country_count.get(country, 0) + 1

        threshold = float(getattr(self._config_repo.get().risk, "max_concentration_pct", 60.0))
        groups: list[ConcentrationGroup] = []
        for country, risk_amount in sorted(country_risk.items(), key=lambda item: item[1], reverse=True):
            risk_pct = (risk_amount / open_risk * 100.0) if open_risk > 0 else 0.0
            groups.append(
                ConcentrationGroup(
                    country=country,
                    risk_amount=risk_amount,
                    risk_pct=risk_pct,
                    position_count=country_count[country],
                    warning=risk_pct >= threshold,
                )
            )
        return groups
