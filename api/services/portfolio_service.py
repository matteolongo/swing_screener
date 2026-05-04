"""Portfolio service - positions and live DeGiro order reads."""
from __future__ import annotations

import datetime as dt
import logging
import uuid
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

import pandas as pd
from fastapi import HTTPException

from api.models.portfolio import (
    ConcentrationGroup,
    CreateOrderRequest,
    CreatePositionRequest,
    DegiroOrder,
    DegiroOrdersResponse,
    EarningsProximityResponse,
    FillOrderRequest,
    FillOrderResponse,
    FillFromDegiroResponse,
    Position,
    PositionUpdate,
    PositionWithMetrics,
    PositionsWithMetricsResponse,
    PositionMetrics,
    PortfolioSummary,
    UpdateStopRequest,
    ClosePositionRequest,
)
from api.repositories.config_repo import ConfigRepository
from api.repositories.orders_repo import OrdersRepository
from api.repositories.positions_repo import PositionsRepository
from api.utils.files import get_today_str
from swing_screener.portfolio.state import (
    ManageConfig as ManageStateConfig,
    Position as StatePosition,
    evaluate_positions,
    load_positions,
    save_positions,
)
from swing_screener.data.providers import MarketDataProvider, get_default_provider
from swing_screener.data.currency import detect_currency
from swing_screener.portfolio.metrics import (
    calculate_current_position_value,
    calculate_per_share_risk,
    calculate_pnl,
    calculate_r_now,
    calculate_total_position_value,
)
from swing_screener.utils.date_helpers import get_default_history_start

try:
    from swing_screener.integrations.degiro.credentials import load_credentials
    from swing_screener.integrations.degiro.client import DegiroClient
except ImportError:
    load_credentials = None  # type: ignore[assignment]
    DegiroClient = None  # type: ignore[assignment,misc]

logger = logging.getLogger(__name__)


def _resolve_isin(ticker: str) -> Optional[str]:
    """Look up ISIN from the DeGiro ISIN map for a given ticker."""
    try:
        from swing_screener.fundamentals.providers.degiro import _load_isin_map
        isin_map = _load_isin_map()
        isin = isin_map.get(ticker)
        if not isin:
            root = ticker.split(".")[0]
            isin = isin_map.get(root)
        return isin or None
    except Exception:
        return None


# Simple cache for EURUSD rate with 5-minute TTL
_eurusd_cache: dict[str, tuple[float, float]] = {}  # {"eurusd": (rate, timestamp)}
_CACHE_TTL_SECONDS = 300  # 5 minutes
_earnings_cache: dict[str, tuple[str, EarningsProximityResponse]] = {}


def _parse_earnings_date(raw) -> Optional[dt.date]:
    if raw is None or pd.isna(raw):
        return None
    if isinstance(raw, pd.Timestamp):
        raw = raw.to_pydatetime()
    if isinstance(raw, dt.datetime):
        return raw.date()
    if isinstance(raw, dt.date):
        return raw
    try:
        return dt.date.fromisoformat(str(raw)[:10])
    except (TypeError, ValueError):
        return None


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


def _to_iso(ts) -> Optional[str]:
    if ts is None or pd.isna(ts):
        return None
    if isinstance(ts, pd.Timestamp):
        ts = ts.to_pydatetime()
    if isinstance(ts, dt.datetime):
        return ts.isoformat()
    if isinstance(ts, dt.date):
        return dt.datetime.combine(ts, dt.time()).isoformat()
    return str(ts)


def _last_close_map(ohlcv: pd.DataFrame) -> tuple[dict[str, float], dict[str, str]]:
    prices: dict[str, float] = {}
    bars: dict[str, str] = {}
    if ohlcv is None or ohlcv.empty:
        return prices, bars
    if "Close" not in ohlcv.columns.get_level_values(0):
        return prices, bars
    close = ohlcv["Close"]
    for t in close.columns:
        series = close[t].dropna()
        if series.empty:
            continue
        ts = series.index[-1]
        iso = _to_iso(ts)
        if iso:
            bars[str(t)] = iso
        prices[str(t)] = float(series.iloc[-1])
    return prices, bars


def _pct_to_target(target: Optional[float], last_price: Optional[float]) -> Optional[float]:
    if target is None or last_price is None or last_price == 0:
        return None
    return (target - last_price) / last_price * 100.0


def _round_price(value: float) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _manage_cfg_from_app() -> ManageStateConfig:
    manage = ConfigRepository().get().manage
    return ManageStateConfig(
        breakeven_at_R=manage.breakeven_at_r,
        trail_sma=manage.trail_sma,
        trail_after_R=manage.trail_after_r,
        sma_buffer_pct=manage.sma_buffer_pct,
        max_holding_days=manage.max_holding_days,
        time_stop_days=manage.time_stop_days,
        time_stop_min_r=manage.time_stop_min_r,
    )


def _calc_start_date(entry_date: Optional[str], trail_sma: int) -> str:
    buffer_days = max(200, int(trail_sma * 3))
    try:
        entry_dt = pd.to_datetime(entry_date) if entry_date else pd.Timestamp.today()
    except (TypeError, ValueError):
        entry_dt = pd.Timestamp.today()
    today = pd.Timestamp.today()
    if entry_dt > today:
        entry_dt = today
    start_dt = entry_dt - pd.Timedelta(days=buffer_days)
    return start_dt.strftime("%Y-%m-%d")


def _to_state_position(position: dict) -> StatePosition:
    return StatePosition(
        ticker=str(position.get("ticker", "")).upper(),
        status=position.get("status", "open"),
        entry_date=str(position.get("entry_date", "")),
        entry_price=float(position.get("entry_price", 0)),
        stop_price=float(position.get("stop_price", 0)),
        shares=int(position.get("shares", 0)),
        position_id=position.get("position_id"),
        source_order_id=position.get("source_order_id"),
        initial_risk=(
            float(position["initial_risk"])
            if position.get("initial_risk") is not None
            else None
        ),
        max_favorable_price=(
            float(position["max_favorable_price"])
            if position.get("max_favorable_price") is not None
            else None
        ),
        exit_date=position.get("exit_date"),
        exit_price=(
            float(position["exit_price"])
            if position.get("exit_price") is not None
            else None
        ),
        notes=str(position.get("notes", "")),
        exit_order_ids=position.get("exit_order_ids"),
    )


def _normalize_degiro_order(raw: dict) -> DegiroOrder:
    """Convert a raw DeGiro order dict to DegiroOrder model."""
    vals = {v["name"]: v.get("value") for v in raw.get("value", [])} if "value" in raw else raw
    side_raw = str(vals.get("buysell", "") or "").upper()
    side = "buy" if side_raw in ("B", "BUY", "1") else ("sell" if side_raw in ("S", "SELL", "2") else None)
    order_type_raw = vals.get("orderTypeId") or vals.get("orderType")
    return DegiroOrder(
        order_id=str(vals.get("orderId", "") or raw.get("orderId", "")),
        product_id=str(vals.get("productId", "") or "") or None,
        isin=str(vals.get("isin", "") or "") or None,
        product_name=str(vals.get("product", "") or vals.get("productName", "") or "") or None,
        status=str(vals.get("status", "") or vals.get("orderStatus", "") or "").lower(),
        price=float(vals["price"]) if vals.get("price") is not None else None,
        quantity=int(float(vals.get("size", 0) or vals.get("quantity", 0) or 0)),
        order_type=str(order_type_raw) if order_type_raw is not None else None,
        side=side,
        created_at=str(vals.get("date", "") or vals.get("created", "") or "") or None,
    )


class PortfolioService:
    def __init__(
        self,
        positions_repo: PositionsRepository,
        orders_repo: Optional[OrdersRepository] = None,
        provider: Optional[MarketDataProvider] = None
    ) -> None:
        self._positions_repo = positions_repo
        self._orders_repo = orders_repo
        self._provider = provider or get_default_provider()

    def _fetch_last_prices(self, tickers: list[str]) -> dict[str, float]:
        if not tickers:
            return {}

        start_date = get_default_history_start()
        end_date = get_today_str()
        ohlcv = self._provider.fetch_ohlcv(tickers, start_date=start_date, end_date=end_date)
        prices, _ = _last_close_map(ohlcv)
        return prices

    @staticmethod
    def _fallback_price(position: dict) -> float:
        exit_price = position.get("exit_price")
        if exit_price is not None:
            return float(exit_price)
        current_price = position.get("current_price")
        if current_price is not None:
            return float(current_price)
        return float(position.get("entry_price", 0.0))

    def _attach_live_prices(self, positions: list[dict]) -> dict[str, float]:
        """Attach latest price to open positions and return fetched price map."""
        last_prices: dict[str, float] = {}
        open_positions = [p for p in positions if p.get("status") == "open"]
        if open_positions:
            try:
                tickers = list({str(p.get("ticker", "")).upper() for p in open_positions if p.get("ticker")})
                last_prices = self._fetch_last_prices(tickers)
                for pos in positions:
                    if pos.get("status") == "open":
                        ticker = str(pos.get("ticker", "")).upper()
                        pos["current_price"] = last_prices.get(ticker)
            except (KeyError, ValueError, TypeError) as exc:
                logger.warning("Failed to fetch current prices (data error): %s", exc)
                for pos in positions:
                    if pos.get("status") == "open":
                        pos["current_price"] = None
            except Exception:
                logger.exception("Unexpected error fetching current prices")
                for pos in positions:
                    if pos.get("status") == "open":
                        pos["current_price"] = None

        return last_prices

    def _eurusd_rate(self) -> float:
        """Fetch EURUSD rate with simple caching."""
        import time
        now = time.time()
        cached = _eurusd_cache.get("eurusd")
        if cached is not None:
            rate, timestamp = cached
            if now - timestamp < _CACHE_TTL_SECONDS:
                return rate

        try:
            fx = self._fetch_last_prices(["EURUSD=X"])
            rate = float(fx.get("EURUSD=X", 0.0))
            rate = rate if rate > 0 else 1.0
            _eurusd_cache["eurusd"] = (rate, now)
            return rate
        except Exception as exc:
            logger.warning("Failed to fetch EURUSD fx rate: %s", exc)
            return 1.0

    def _build_position_with_metrics(
        self,
        position: dict,
        current_prices: dict[str, float],
        eurusd_rate: float,
        *,
        time_stop_days: int | None = None,
        time_stop_min_r: float | None = None,
    ) -> PositionWithMetrics:
        state_position = _to_state_position(position)
        ticker = state_position.ticker.upper()
        live_price = current_prices.get(ticker)
        current_price_for_metrics = live_price if live_price is not None else self._fallback_price(position)
        per_share_risk = calculate_per_share_risk(state_position)
        entry_fee_eur = float(position.get("entry_fee_eur") or 0.0)
        fee_for_pnl = entry_fee_eur * eurusd_rate if detect_currency(ticker) == "USD" else entry_fee_eur
        pnl = calculate_pnl(state_position.entry_price, current_price_for_metrics, state_position.shares) - fee_for_pnl
        entry_value = calculate_total_position_value(state_position.entry_price, state_position.shares)
        pnl_percent = (pnl / entry_value * 100.0) if entry_value > 0 else 0.0

        payload = dict(position)
        if state_position.status == "open" and live_price is not None:
            payload["current_price"] = live_price

        days_open = self._days_open(state_position.entry_date)
        r_now = calculate_r_now(state_position, current_price_for_metrics)
        manage_defaults = ManageStateConfig()
        stale_days = int(time_stop_days or manage_defaults.time_stop_days)
        min_progress_r = float(time_stop_min_r if time_stop_min_r is not None else manage_defaults.time_stop_min_r)
        time_stop_warning = (
            state_position.status == "open"
            and days_open >= stale_days
            and r_now < min_progress_r
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
        current_prices = self._attach_live_prices(positions)
        has_usd_positions = any(
            detect_currency(str(position.get("ticker", "")).upper()) == "USD"
            for position in positions
        )
        eurusd_rate = self._eurusd_rate() if has_usd_positions else 1.0

        positions_with_metrics = [
            self._build_position_with_metrics(
                position,
                current_prices,
                eurusd_rate,
                time_stop_days=time_stop_days,
                time_stop_min_r=time_stop_min_r,
            )
            for position in positions
        ]
        return PositionsWithMetricsResponse(positions=positions_with_metrics, asof=asof)

    def get_position(self, position_id: str) -> Position:
        position = self._positions_repo.get_position(position_id)
        if position is None:
            raise HTTPException(status_code=404, detail=f"Position not found: {position_id}")
        return Position(**position)

    def get_position_metrics(self, position_id: str) -> PositionMetrics:
        position = self._positions_repo.get_position(position_id)
        if position is None:
            raise HTTPException(status_code=404, detail=f"Position not found: {position_id}")

        ticker = str(position.get("ticker", "")).upper()
        current_price = self._fallback_price(position)

        if position.get("status") == "open" and ticker:
            try:
                current_price = self._fetch_last_prices([ticker]).get(ticker, current_price)
            except Exception as exc:
                logger.warning("Failed to fetch current price for %s metrics: %s", ticker, exc)

        state_position = _to_state_position(position)
        entry_fee_eur = float(position.get("entry_fee_eur") or 0.0)
        eurusd_rate = self._eurusd_rate() if detect_currency(ticker) == "USD" and entry_fee_eur else 1.0
        fee_for_pnl = entry_fee_eur * eurusd_rate if detect_currency(ticker) == "USD" else entry_fee_eur
        pnl = calculate_pnl(state_position.entry_price, current_price, state_position.shares) - fee_for_pnl
        per_share_risk = calculate_per_share_risk(state_position)
        entry_value = calculate_total_position_value(state_position.entry_price, state_position.shares)
        pnl_percent = (pnl / entry_value * 100.0) if entry_value > 0 else 0.0

        return PositionMetrics(
            ticker=ticker,
            pnl=pnl,
            fees_eur=entry_fee_eur,
            pnl_percent=pnl_percent,
            r_now=calculate_r_now(state_position, current_price),
            entry_value=entry_value,
            current_value=calculate_current_position_value(current_price, state_position.shares),
            per_share_risk=per_share_risk,
            total_risk=per_share_risk * state_position.shares,
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

        threshold = float(getattr(ConfigRepository().get().risk, "max_concentration_pct", 60.0))
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

    def get_earnings_proximity(self, ticker: str) -> EarningsProximityResponse:
        normalized_ticker = ticker.strip().upper()
        today = get_today_str()
        cached = _earnings_cache.get(normalized_ticker)
        if cached is not None:
            cached_date, cached_response = cached
            if cached_date == today:
                return cached_response

        try:
            import yfinance

            calendar = yfinance.Ticker(normalized_ticker).calendar or {}
            earnings_dates = calendar.get("Earnings Date", [])
            if not isinstance(earnings_dates, list):
                earnings_dates = [earnings_dates]

            today_dt = dt.date.fromisoformat(today)
            upcoming = sorted(
                parsed
                for raw_date in earnings_dates
                if (parsed := _parse_earnings_date(raw_date)) is not None and parsed >= today_dt
            )
            if not upcoming:
                result = EarningsProximityResponse(ticker=normalized_ticker)
            else:
                next_date = upcoming[0]
                days_until = (next_date - today_dt).days
                result = EarningsProximityResponse(
                    ticker=normalized_ticker,
                    next_earnings_date=next_date.isoformat(),
                    days_until=days_until,
                    warning=days_until <= 10,
                )
        except Exception as exc:
            logger.info("Failed to fetch earnings calendar for %s: %s", normalized_ticker, exc)
            result = EarningsProximityResponse(ticker=normalized_ticker)

        _earnings_cache[normalized_ticker] = (today, result)
        return result

    def create_order(self, request: CreateOrderRequest) -> dict:
        """Create a pending entry order in orders.json."""
        if self._orders_repo is None:
            raise HTTPException(status_code=503, detail="Orders repository not configured")

        ticker = request.ticker.upper()
        orders, _ = self._orders_repo.list_orders()

        if request.order_kind == "entry":
            pending_entry = any(
                o.get("ticker") == ticker
                and o.get("status") == "pending"
                and o.get("order_kind") == "entry"
                for o in orders
            )
            if pending_entry:
                raise HTTPException(status_code=409, detail=f"{ticker}: pending entry order already exists.")

            positions, _ = self._positions_repo.list_positions(status="open")
            open_position = next((p for p in positions if p.get("ticker") == ticker), None)

            if request.entry_mode == "ADD_ON":
                if not open_position:
                    raise HTTPException(status_code=409, detail=f"{ticker}: no open position found for add-on order.")
            elif open_position:
                raise HTTPException(
                    status_code=409,
                    detail=f"{ticker}: open position already exists. Create this as an ADD_ON order instead.",
                )

        existing_ids = {o.get("order_id", "") for o in orders}
        base = f"ORD-{ticker}"
        n = 1
        order_id = f"{base}-{n:03d}"
        while order_id in existing_ids:
            n += 1
            order_id = f"{base}-{n:03d}"

        isin = request.isin or _resolve_isin(ticker)
        order = {
            "order_id": order_id,
            "ticker": ticker,
            "status": "pending",
            "order_type": request.order_type,
            "quantity": request.quantity,
            "limit_price": request.limit_price,
            "stop_price": request.stop_price,
            "order_date": get_today_str(),
            "filled_date": None,
            "entry_price": None,
            "notes": request.notes.strip(),
            "order_kind": request.order_kind,
            "parent_order_id": None,
            "position_id": request.position_id if request.entry_mode == "ADD_ON" else None,
            "tif": "GTC",
            "fee_eur": None,
            "fill_fx_rate": None,
            "isin": isin,
            "thesis": request.thesis,
        }
        self._orders_repo.append_order(order)
        return order

    def list_local_orders(self, status: Optional[str] = None) -> dict:
        """List locally stored orders from orders.json."""
        if self._orders_repo is None:
            raise HTTPException(status_code=503, detail="Orders repository not configured")
        orders, asof = self._orders_repo.list_orders(status=status)
        return {"orders": orders, "asof": asof}

    def fill_order(self, order_id: str, request: FillOrderRequest) -> FillOrderResponse:
        """Mark a pending order as filled and create the open position."""
        if self._orders_repo is None:
            raise HTTPException(status_code=503, detail="Orders repository not configured")

        order = self._orders_repo.get_order(order_id)
        if order is None:
            raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
        if order.get("status") != "pending":
            raise HTTPException(status_code=409, detail=f"Order {order_id} is already {order.get('status')}")

        ticker = order["ticker"]
        stop_price = request.stop_price if request.stop_price is not None else order.get("stop_price")
        if not stop_price or stop_price <= 0:
            raise HTTPException(status_code=422, detail=f"No valid stop price for order {order_id}")
        if stop_price >= request.filled_price:
            raise HTTPException(status_code=422, detail="stop_price must be below filled_price")

        updates = {
            "status": "filled",
            "entry_price": request.filled_price,
            "filled_date": request.filled_date,
            "fee_eur": request.fee_eur,
            "fill_fx_rate": request.fill_fx_rate,
            "stop_price": stop_price,
        }
        self._orders_repo.update_order(order_id, updates)

        isin = order.get("isin") or _resolve_isin(ticker)
        position_id = f"POS-{uuid.uuid4().hex[:8].upper()}"
        initial_risk = (request.filled_price - stop_price) * order["quantity"]

        new_position: dict = {
            "position_id": position_id,
            "ticker": ticker,
            "status": "open",
            "entry_date": request.filled_date,
            "entry_price": request.filled_price,
            "stop_price": stop_price,
            "shares": order["quantity"],
            "initial_risk": initial_risk,
            "source_order_id": order_id,
            "isin": isin,
            "thesis": order.get("thesis"),
            "notes": order.get("notes", ""),
            "entry_fee_eur": request.fee_eur,
        }

        data = self._positions_repo.read()
        positions = data.get("positions", [])
        positions.append(new_position)
        data["positions"] = positions
        data["asof"] = get_today_str()
        self._positions_repo.write(data)

        return FillOrderResponse(order_id=order_id, position=Position(**new_position))

    def fill_order_from_degiro(self, order_id: str, degiro_order_id: str) -> FillFromDegiroResponse:
        """Fill a local pending order using data from a specific DeGiro order."""
        from datetime import date, timedelta

        if self._orders_repo is None:
            raise HTTPException(status_code=503, detail="Orders repository not configured")

        order = self._orders_repo.get_order(order_id)
        if order is None:
            raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
        if order.get("status") != "pending":
            raise HTTPException(status_code=409, detail=f"Order {order_id} is already {order.get('status')}")

        # Fetch last 90 days of order history to cover older fills
        to_date = get_today_str()
        from_date = (date.fromisoformat(to_date) - timedelta(days=90)).isoformat()

        credentials = load_credentials()
        with DegiroClient(credentials) as client:
            raw_orders = client.get_order_history(from_date=from_date, to_date=to_date)

        degiro_order = next(
            (o for o in raw_orders if str(o.get("orderId", "")) == degiro_order_id),
            None,
        )
        if degiro_order is None:
            raise HTTPException(
                status_code=422,
                detail=f"DeGiro order {degiro_order_id} not found in history (last 90 days)",
            )

        fill_price = float(degiro_order.get("price", 0))
        fill_qty = int(float(degiro_order.get("size", 0) or degiro_order.get("quantity", 0) or 0))
        fill_date_raw = str(degiro_order.get("date", "") or get_today_str())
        fill_date = fill_date_raw[:10]  # YYYY-MM-DD
        isin_from_degiro = str(degiro_order.get("isin", "") or "") or None
        product_id = str(degiro_order.get("productId", "") or "") or None

        quantity_mismatch = fill_qty != order.get("quantity", 0)

        # Write broker fields to order before fill
        broker_updates: dict = {
            "broker_order_id": degiro_order_id,
            "broker": "degiro",
            "broker_synced_at": get_today_str(),
        }
        if isin_from_degiro and not order.get("isin"):
            broker_updates["isin"] = isin_from_degiro
        self._orders_repo.update_order(order_id, broker_updates)

        fill_request = FillOrderRequest(
            filled_price=fill_price,
            filled_date=fill_date,
            fee_eur=None,
        )
        fill_response = self.fill_order(order_id, fill_request)

        # Stamp broker fields on the created position
        if product_id:
            data = self._positions_repo.read()
            for pos in data.get("positions", []):
                if pos.get("source_order_id") == order_id:
                    pos["broker_product_id"] = product_id
                    pos["broker"] = "degiro"
                    pos["broker_synced_at"] = get_today_str()
            self._positions_repo.write(data)

        return FillFromDegiroResponse(
            order_id=order_id,
            broker_order_id=degiro_order_id,
            quantity_mismatch=quantity_mismatch,
            position=fill_response.position,
        )

    def create_position(self, request: CreatePositionRequest) -> Position:
        """Register a position directly (after manual fill at DeGiro)."""
        data = self._positions_repo.read()
        positions = data.get("positions", [])

        ticker = request.ticker.upper()
        position_id = f"POS-{uuid.uuid4().hex[:8].upper()}"
        initial_risk = (request.entry_price - request.stop_price) * request.shares
        isin = request.isin or _resolve_isin(ticker)

        new_position: dict = {
            "position_id": position_id,
            "ticker": ticker,
            "status": "open",
            "entry_date": request.entry_date,
            "entry_price": request.entry_price,
            "stop_price": request.stop_price,
            "shares": request.shares,
            "initial_risk": initial_risk,
            "thesis": request.thesis,
            "isin": isin,
            "notes": request.notes,
            "broker": "degiro",
            "entry_fee_eur": request.fee_eur,
        }

        positions.append(new_position)
        data["positions"] = positions
        data["asof"] = get_today_str()
        self._positions_repo.write(data)

        return Position(**new_position)

    def update_position_stop(self, position_id: str, request: UpdateStopRequest) -> dict:
        data = self._positions_repo.read()
        positions = data.get("positions", [])
        found = False
        old_stop = None
        new_stop = _round_price(request.new_stop)

        for pos in positions:
            if pos.get("position_id") == position_id:
                if pos.get("status") != "open":
                    raise HTTPException(status_code=400, detail="Cannot update stop on closed position")

                old_stop = _round_price(float(pos.get("stop_price")))

                if new_stop <= old_stop:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot move stop down. Current: {old_stop}, Requested: {new_stop}",
                    )

                ticker = pos.get("ticker")
                current_price = None
                try:
                    end_date = get_today_str()
                    start_date = (pd.Timestamp(end_date) - pd.Timedelta(days=5)).strftime("%Y-%m-%d")
                    ohlcv = self._provider.fetch_ohlcv([ticker], start_date=start_date, end_date=end_date)
                    if not ohlcv.empty and ticker in ohlcv.columns.get_level_values(1):
                        latest_close = ohlcv[("Close", ticker)].iloc[-1]
                        if not pd.isna(latest_close):
                            current_price = float(latest_close)
                except Exception as exc:
                    logger.warning("Could not fetch current price for validation: %s", exc)

                if current_price is not None and new_stop > current_price:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Stop price ({new_stop}) must be at or below current price "
                            f"({current_price}) for long positions"
                        ),
                    )

                pos["stop_price"] = new_stop
                if request.reason:
                    current_notes = pos.get("notes", "")
                    pos["notes"] = f"{current_notes}\nStop updated to {new_stop}: {request.reason}".strip()

                found = True
                break

        if not found:
            raise HTTPException(status_code=404, detail=f"Position not found: {position_id}")

        data["asof"] = get_today_str()
        self._positions_repo.write(data)

        return {
            "status": "ok",
            "position_id": position_id,
            "new_stop": new_stop,
            "old_stop": old_stop,
        }

    def close_position(self, position_id: str, request: ClosePositionRequest) -> dict:
        data = self._positions_repo.read()
        positions = data.get("positions", [])
        found = False

        for pos in positions:
            if pos.get("position_id") == position_id:
                if pos.get("status") != "open":
                    raise HTTPException(status_code=400, detail="Position already closed")

                pos["status"] = "closed"
                pos["exit_price"] = request.exit_price
                pos["exit_date"] = get_today_str()
                pos["exit_fee_eur"] = request.fee_eur
                if request.reason:
                    current_notes = pos.get("notes", "")
                    pos["notes"] = f"{current_notes}\nClosed: {request.reason}".strip()
                if request.lesson is not None:
                    pos["lesson"] = request.lesson
                pos["tags"] = list(request.tags)

                found = True
                break

        if not found:
            raise HTTPException(status_code=404, detail=f"Position not found: {position_id}")

        data["asof"] = get_today_str()
        self._positions_repo.write(data)

        return {
            "status": "ok",
            "position_id": position_id,
            "exit_price": request.exit_price,
            "fee_eur": request.fee_eur,
        }

    def _resolve_manage_cfg(self, payload: Optional[dict] = None) -> ManageStateConfig:
        if payload is None:
            return _manage_cfg_from_app()
        return ManageStateConfig(
            breakeven_at_R=float(payload.get("breakeven_at_r", 1.0)),
            trail_sma=int(payload.get("trail_sma", 20)),
            trail_after_R=float(payload.get("trail_after_r", 2.0)),
            sma_buffer_pct=float(payload.get("sma_buffer_pct", 0.005)),
            max_holding_days=int(payload.get("max_holding_days", 20)),
            time_stop_days=int(payload.get("time_stop_days", 15)),
            time_stop_min_r=float(payload.get("time_stop_min_r", 0.5)),
        )

    def _suggest_position_stop_from_dict(
        self,
        position: dict,
        manage_payload: Optional[dict] = None,
    ) -> PositionUpdate:
        if position.get("status") != "open":
            raise HTTPException(status_code=400, detail="Stop suggestions require an open position")

        ticker = position.get("ticker")
        if not ticker:
            raise HTTPException(status_code=400, detail="Position ticker is missing")

        manage_cfg = self._resolve_manage_cfg(manage_payload)
        start_date = _calc_start_date(position.get("entry_date"), manage_cfg.trail_sma)
        end_date = get_today_str()

        try:
            ohlcv = self._provider.fetch_ohlcv([ticker], start_date=start_date, end_date=end_date)
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to fetch market data for {ticker}: {exc}",
            ) from exc

        try:
            updates, _ = evaluate_positions(ohlcv, [_to_state_position(position)], manage_cfg)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to compute stop suggestion: {exc}",
            ) from exc

        if not updates:
            raise HTTPException(status_code=500, detail="No stop suggestion available")

        update = updates[0]
        return PositionUpdate(
            ticker=update.ticker,
            status=update.status,
            last=update.last,
            entry=update.entry,
            stop_old=update.stop_old,
            stop_suggested=update.stop_suggested,
            shares=update.shares,
            r_now=update.r_now,
            action=update.action,
            reason=update.reason,
        )

    def compute_position_stop_suggestion(
        self,
        position_payload: dict,
        manage_payload: Optional[dict] = None,
    ) -> PositionUpdate:
        return self._suggest_position_stop_from_dict(position_payload, manage_payload)

    def suggest_position_stop(self, position_id: str) -> PositionUpdate:
        position = self._positions_repo.get_position(position_id)
        if position is None:
            raise HTTPException(status_code=404, detail=f"Position not found: {position_id}")
        return self._suggest_position_stop_from_dict(position)

    def list_degiro_orders(self) -> DegiroOrdersResponse:
        """Fetch live orders from DeGiro API."""
        credentials = load_credentials()
        with DegiroClient(credentials) as client:
            raw_orders = client.get_orders()

        orders = [_normalize_degiro_order(o) for o in raw_orders]
        return DegiroOrdersResponse(orders=orders, asof=get_today_str())

    def list_degiro_order_history(self, from_date: str, to_date: str) -> DegiroOrdersResponse:
        """Fetch recent filled/cancelled orders from DeGiro order history."""
        credentials = load_credentials()
        with DegiroClient(credentials) as client:
            raw_orders = client.get_order_history(from_date=from_date, to_date=to_date)

        orders = [_normalize_degiro_order(o) for o in raw_orders]
        return DegiroOrdersResponse(orders=orders, asof=get_today_str())
