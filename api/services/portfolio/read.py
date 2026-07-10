"""Read-model: list/get positions and portfolio summary."""
from __future__ import annotations

import datetime as dt
import logging
from typing import Optional

from swing_screener.errors import NotFoundError
from swing_screener.data.currency import detect_currency
from swing_screener.risk.currency import convert_via_eurusd
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


def _to_account_currency(
    amount: float,
    *,
    position_currency: str,
    account_currency: str,
    eurusd_rate: float,
) -> float:
    quote = str(position_currency or "").strip().upper()
    account = str(account_currency or "EUR").strip().upper()
    if quote == account or quote in {"", "UNKNOWN"}:
        return amount
    if eurusd_rate <= 0:
        logger.warning(
            "Invalid EURUSD rate %s; leaving %s amount unconverted",
            eurusd_rate,
            quote,
        )
        return amount
    converted, ok = convert_via_eurusd(amount, quote, account, eurusd_rate)
    if not ok:
        logger.warning(
            "No FX conversion path for %s -> %s; leaving amount unconverted",
            quote,
            account,
        )
        return amount
    return converted


def _needs_eurusd_rate(position_currency: str, account_currency: str) -> bool:
    quote = str(position_currency or "").strip().upper()
    account = str(account_currency or "EUR").strip().upper()
    return quote != account and {quote, account} == {"USD", "EUR"}


def _positive_float(value) -> Optional[float]:
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _partial_close_share_count(position: dict) -> int:
    total = 0
    for event in position.get("partial_closes") or []:
        total += int(event.get("shares_closed", 0) or 0)
    return total


def _original_share_count(position: dict) -> int:
    current_shares = int(position.get("shares", 0) or 0)
    return current_shares + _partial_close_share_count(position)


def _allocated_entry_fee_eur(position: dict, shares: int) -> float:
    total_entry_fee_eur = float(position.get("entry_fee_eur") or 0.0)
    original_shares = _original_share_count(position)
    if total_entry_fee_eur <= 0 or shares <= 0 or original_shares <= 0:
        return 0.0
    return total_entry_fee_eur * (shares / original_shares)


def _remaining_entry_fee_eur(position: dict) -> float:
    return _allocated_entry_fee_eur(position, int(position.get("shares", 0) or 0))


def _fee_eur_to_account_currency(
    fee_eur: float,
    *,
    account_currency: str,
    eurusd_rate: float,
) -> float:
    account = str(account_currency or "EUR").strip().upper()
    if account == "EUR":
        return fee_eur
    if eurusd_rate <= 0:
        logger.warning(
            "Invalid EURUSD rate %s; leaving EUR fee unconverted",
            eurusd_rate,
        )
        return fee_eur
    converted, ok = convert_via_eurusd(fee_eur, "EUR", account, eurusd_rate)
    if not ok:
        logger.warning(
            "No FX conversion path for EUR fee -> %s; leaving amount unconverted",
            account,
        )
        return fee_eur
    return converted


def _fee_eur_to_position_currency(
    fee_eur: float,
    *,
    position_currency: str,
    eurusd_rate: float,
) -> float:
    quote = str(position_currency or "").strip().upper()
    converted, ok = convert_via_eurusd(fee_eur, "EUR", quote, eurusd_rate)
    return converted if ok else fee_eur


def _rate_for_conversion(raw_rate, fallback_rate: float) -> float:
    return _positive_float(raw_rate) or fallback_rate


def _realized_leg_pnl_account_currency(
    *,
    entry_price: float,
    exit_price: float,
    shares: int,
    position_currency: str,
    account_currency: str,
    entry_fx_rate,
    exit_fx_rate,
    fallback_eurusd_rate: float,
) -> float:
    entry_rate = _rate_for_conversion(entry_fx_rate, fallback_eurusd_rate)
    exit_rate = _rate_for_conversion(exit_fx_rate, fallback_eurusd_rate)
    entry_value = _to_account_currency(
        entry_price * shares,
        position_currency=position_currency,
        account_currency=account_currency,
        eurusd_rate=entry_rate,
    )
    exit_value = _to_account_currency(
        exit_price * shares,
        position_currency=position_currency,
        account_currency=account_currency,
        eurusd_rate=exit_rate,
    )
    return exit_value - entry_value


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
        live_tickers: frozenset[str] = frozenset(),
        time_stop_days: int | None = None,
        time_stop_min_r: float | None = None,
    ) -> PositionWithMetrics:
        state_position = to_state_position(position)
        ticker = state_position.ticker.upper()
        live_price = current_prices.get(ticker)
        current_price_for_metrics = live_price if live_price is not None else self._pricing._fallback_price(position)
        per_share_risk = calculate_per_share_risk(state_position)
        position_currency = detect_currency(ticker)
        entry_fee_eur = _remaining_entry_fee_eur(position)
        if state_position.status == "closed":
            entry_fee_eur += float(position.get("exit_fee_eur") or 0.0)
        fee_for_pnl = _fee_eur_to_position_currency(
            entry_fee_eur,
            position_currency=position_currency,
            eurusd_rate=eurusd_rate,
        )
        pnl = calculate_pnl(state_position.entry_price, current_price_for_metrics, state_position.shares) - fee_for_pnl
        entry_value = calculate_total_position_value(state_position.entry_price, state_position.shares)
        pnl_percent = (pnl / entry_value * 100.0) if entry_value > 0 else 0.0

        payload = dict(position)
        if state_position.status == "open" and live_price is not None:
            payload["current_price"] = live_price

        if live_price is not None and ticker in live_tickers:
            price_source = "live"
        elif live_price is not None or position.get("current_price") is not None:
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
        current_prices, live_tickers = self._pricing._attach_live_prices(positions)
        account_currency = getattr(self._config_repo.get().risk, "account_currency", "EUR")
        needs_eurusd = any(
            _needs_eurusd_rate(
                detect_currency(str(position.get("ticker", "")).upper()),
                account_currency,
            )
            for position in positions
        )
        eurusd_rate = self._pricing._eurusd_rate() if needs_eurusd else 1.0

        positions_with_metrics = [
            self._build_position_with_metrics(
                position,
                current_prices,
                eurusd_rate,
                account_currency,
                live_tickers=live_tickers,
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
        # Non-open positions (closed) have a fixed, recorded price - label unchanged from prior behavior.
        price_source = "live"

        if position.get("status") == "open" and ticker:
            live_quote = self._pricing._fetch_live_quote(ticker)
            if live_quote is not None:
                current_price = live_quote
                price_source = "live"
            else:
                try:
                    last_close = self._pricing._fetch_last_prices([ticker]).get(ticker)
                except Exception as exc:
                    logger.warning("Failed to fetch current price for %s metrics: %s", ticker, exc)
                    last_close = None
                if last_close is not None:
                    current_price = last_close
                    price_source = "cached"

        state_position = to_state_position(position)
        position_currency = detect_currency(ticker)
        entry_fee_eur = _remaining_entry_fee_eur(position)
        if state_position.status == "closed":
            entry_fee_eur += float(position.get("exit_fee_eur") or 0.0)
        eurusd_rate = self._pricing._eurusd_rate() if position_currency == "USD" and entry_fee_eur else 1.0
        fee_for_pnl = _fee_eur_to_position_currency(
            entry_fee_eur,
            position_currency=position_currency,
            eurusd_rate=eurusd_rate,
        )
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
                fx_rate=e.get("fx_rate"),
            )
            for e in raw_events
        ]

        blended_r: Optional[float] = None
        if partial_close_events:
            total_shares = sum(e.shares_closed for e in partial_close_events)
            blended_r = sum(e.shares_closed * e.r_at_close for e in partial_close_events) / total_shares

        account_currency = getattr(self._config_repo.get().risk, "account_currency", "EUR")
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
            price_source=price_source,
            r_uses_initial_risk=r_uses_initial_risk_metrics,
        )

    def _realized_pnl(
        self,
        positions: list[dict],
        *,
        account_currency: str,
        eurusd_rate: float,
    ) -> float:
        realized_pnl = 0.0
        for position in positions:
            entry_price = float(position.get("entry_price", 0.0))
            position_currency = detect_currency(str(position.get("ticker", "")).upper())
            entry_fx_rate = position.get("entry_fx_rate")

            for event in position.get("partial_closes") or []:
                shares_closed = int(event.get("shares_closed", 0) or 0)
                if shares_closed <= 0:
                    continue
                event_fx_rate = event.get("fx_rate")
                realized_pnl += _realized_leg_pnl_account_currency(
                    entry_price=entry_price,
                    exit_price=float(event.get("price", 0.0)),
                    shares=shares_closed,
                    position_currency=position_currency,
                    account_currency=account_currency,
                    entry_fx_rate=entry_fx_rate,
                    exit_fx_rate=event_fx_rate,
                    fallback_eurusd_rate=eurusd_rate,
                )
                realized_pnl -= _fee_eur_to_account_currency(
                    _allocated_entry_fee_eur(position, shares_closed),
                    account_currency=account_currency,
                    eurusd_rate=_rate_for_conversion(entry_fx_rate, eurusd_rate),
                )
                fee_eur = event.get("fee_eur")
                if fee_eur is not None:
                    realized_pnl -= _fee_eur_to_account_currency(
                        abs(float(fee_eur)),
                        account_currency=account_currency,
                        eurusd_rate=_rate_for_conversion(event_fx_rate, eurusd_rate),
                    )

            if position.get("status") != "closed" or position.get("exit_price") is None:
                continue

            final_shares = int(position.get("shares", 0) or 0)
            if final_shares <= 0:
                continue
            exit_fx_rate = position.get("exit_fx_rate")
            realized_pnl += _realized_leg_pnl_account_currency(
                entry_price=entry_price,
                exit_price=float(position.get("exit_price")),
                shares=final_shares,
                position_currency=position_currency,
                account_currency=account_currency,
                entry_fx_rate=entry_fx_rate,
                exit_fx_rate=exit_fx_rate,
                fallback_eurusd_rate=eurusd_rate,
            )
            realized_pnl -= _fee_eur_to_account_currency(
                _allocated_entry_fee_eur(position, final_shares),
                account_currency=account_currency,
                eurusd_rate=_rate_for_conversion(entry_fx_rate, eurusd_rate),
            )
            exit_fee_eur = position.get("exit_fee_eur")
            if exit_fee_eur is not None:
                realized_pnl -= _fee_eur_to_account_currency(
                    abs(float(exit_fee_eur)),
                    account_currency=account_currency,
                    eurusd_rate=_rate_for_conversion(exit_fx_rate, eurusd_rate),
                )
        return realized_pnl

    def get_portfolio_summary(self, account_size: float, account_size_mode: str = "equity") -> PortfolioSummary:
        account_currency = str(getattr(self._config_repo.get().risk, "account_currency", "EUR")).upper()
        all_positions, _ = self._positions_repo.list_positions(status=None)
        needs_eurusd = any(
            _needs_eurusd_rate(
                detect_currency(str(position.get("ticker", "")).upper()),
                account_currency,
            )
            for position in all_positions
        )
        realized_eurusd_rate = self._pricing._eurusd_rate() if needs_eurusd else 1.0
        realized_pnl = self._realized_pnl(
            all_positions,
            account_currency=account_currency,
            eurusd_rate=realized_eurusd_rate,
        )
        effective_account_size = account_size + realized_pnl if account_size_mode == "equity" else account_size
        positions_response = self.list_positions(status="open")
        positions = positions_response.positions
        needs_open_eurusd = any(
            _needs_eurusd_rate(detect_currency(position.ticker.upper()), account_currency)
            for position in positions
        )
        eurusd_rate = self._pricing._eurusd_rate() if needs_open_eurusd else 1.0
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
            position_currency = detect_currency(position.ticker.upper())
            entry_value_account = _to_account_currency(
                position.entry_value,
                position_currency=position_currency,
                account_currency=account_currency,
                eurusd_rate=eurusd_rate,
            )
            current_value_account = _to_account_currency(
                position.current_value,
                position_currency=position_currency,
                account_currency=account_currency,
                eurusd_rate=eurusd_rate,
            )
            pnl_account = _to_account_currency(
                position.pnl,
                position_currency=position_currency,
                account_currency=account_currency,
                eurusd_rate=eurusd_rate,
            )
            risk_account = _to_account_currency(
                position.total_risk,
                position_currency=position_currency,
                account_currency=account_currency,
                eurusd_rate=eurusd_rate,
            )

            total_cost_basis += entry_value_account
            total_value += current_value_account
            total_pnl += pnl_account
            total_fees_eur += position.fees_eur

            if risk_account > 0:
                open_risk += risk_account
                total_r_now += position.r_now
                r_count += 1

            if current_value_account > largest_position_value:
                largest_position_value = current_value_account
                largest_position_ticker = position.ticker

            if position.pnl_percent > best_performer_pnl_pct:
                best_performer_pnl_pct = position.pnl_percent
                best_performer_ticker = position.ticker

            if position.pnl_percent < worst_performer_pnl_pct:
                worst_performer_pnl_pct = position.pnl_percent
                worst_performer_ticker = position.ticker

            if pnl_account > 0:
                positions_profitable += 1
            elif pnl_account < 0:
                positions_losing += 1

        total_pnl_percent = (total_pnl / total_cost_basis * 100.0) if total_cost_basis > 0 else 0.0
        open_risk_percent = (open_risk / effective_account_size * 100.0) if effective_account_size > 0 else 0.0
        avg_r_now = (total_r_now / r_count) if r_count > 0 else 0.0
        win_rate = (positions_profitable / len(positions) * 100.0) if positions else 0.0
        concentration = self._concentration_groups(
            positions,
            open_risk,
            account_currency=account_currency,
            eurusd_rate=eurusd_rate,
        )

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
        *,
        account_currency: str = "EUR",
        eurusd_rate: float = 1.0,
    ) -> list[ConcentrationGroup]:
        country_risk: dict[str, float] = {}
        country_count: dict[str, int] = {}
        for position in positions:
            risk_amount = _to_account_currency(
                position.total_risk,
                position_currency=detect_currency(position.ticker.upper()),
                account_currency=account_currency,
                eurusd_rate=eurusd_rate,
            )
            if risk_amount <= 0:
                continue
            country = _country_from_ticker(position.ticker)
            country_risk[country] = country_risk.get(country, 0.0) + risk_amount
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
