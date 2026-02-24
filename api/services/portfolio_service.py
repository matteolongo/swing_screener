"""Portfolio service - positions and orders logic."""
from __future__ import annotations

from collections import defaultdict
from dataclasses import replace
import datetime as dt
import logging
from typing import Optional

import pandas as pd
from fastapi import HTTPException

from api.models.portfolio import (
    Position,
    PositionUpdate,
    PositionWithMetrics,
    PositionsWithMetricsResponse,
    PositionMetrics,
    PortfolioSummary,
    Order,
    OrdersResponse,
    OrderSnapshot,
    OrdersSnapshotResponse,
    CreateOrderRequest,
    FillOrderRequest,
    UpdateStopRequest,
    ClosePositionRequest,
    PortfolioSyncResponse,
    PortfolioExportResponse,
)
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
from swing_screener.execution.orders import load_orders, save_orders
from swing_screener.execution.order_workflows import (
    fill_entry_order,
    infer_order_kind,
    normalize_orders,
)
from swing_screener.data.providers import MarketDataProvider, get_default_provider
from swing_screener.data.currency import detect_currency
from swing_screener.execution.providers import (
    ExecutionOrder,
    ExecutionProvider,
    SubmitOrderRequest,
)
from swing_screener.portfolio.metrics import (
    calculate_current_position_value,
    calculate_per_share_risk,
    calculate_pnl,
    calculate_r_now,
    calculate_total_position_value,
)
from swing_screener.utils.date_helpers import get_default_backtest_start

logger = logging.getLogger(__name__)

# Simple cache for EURUSD rate with 5-minute TTL
_eurusd_cache: dict[str, tuple[float, float]] = {}  # {"eurusd": (rate, timestamp)}
_CACHE_TTL_SECONDS = 300  # 5 minutes
_BROKER_POSITION_ID_PREFIX = "POS-"


def _normalize_ticker(value: str) -> str:
    return str(value or "").strip().upper()


def _position_id_for_ticker(ticker: str) -> str:
    return f"{_BROKER_POSITION_ID_PREFIX}{_normalize_ticker(ticker)}"


def _ticker_from_position_id(position_id: str) -> str:
    raw = str(position_id or "").strip()
    upper = raw.upper()
    if upper.startswith(_BROKER_POSITION_ID_PREFIX):
        return raw[len(_BROKER_POSITION_ID_PREFIX):].upper()
    return raw.upper()


def _broker_to_api_order_status(status: str) -> str:
    norm = str(status or "").strip().lower()
    if norm in {"filled"}:
        return "filled"
    if norm in {"cancelled", "canceled"}:
        return "cancelled"
    return "pending"


def _broker_to_api_order_type(side: str, order_type: str) -> str:
    side_up = str(side or "buy").strip().upper()
    ot = str(order_type or "market").strip().upper()
    if side_up not in {"BUY", "SELL"}:
        side_up = "BUY"
    mapping = {
        "MARKET": f"{side_up}_MARKET",
        "LIMIT": f"{side_up}_LIMIT",
        "STOP": f"{side_up}_STOP",
        "STOP_LIMIT": f"{side_up}_STOP_LIMIT",
    }
    return mapping.get(ot, f"{side_up}_{ot}")


def _api_to_broker_order_params(request: CreateOrderRequest) -> tuple[str, str]:
    order_type = request.order_type.strip().upper()
    directional_map = {
        "BUY_MARKET": ("buy", "market"),
        "BUY_LIMIT": ("buy", "limit"),
        "BUY_STOP": ("buy", "stop"),
        "BUY_STOP_LIMIT": ("buy", "stop_limit"),
        "SELL_MARKET": ("sell", "market"),
        "SELL_LIMIT": ("sell", "limit"),
        "SELL_STOP": ("sell", "stop"),
        "SELL_STOP_LIMIT": ("sell", "stop_limit"),
    }
    if order_type in directional_map:
        return directional_map[order_type]

    base_type = order_type.lower()
    # Non-directional API orders remain accepted for backward compatibility.
    if request.order_kind in {"stop", "take_profit"}:
        side = "sell"
    else:
        side = "buy"
    if base_type not in {"market", "limit", "stop", "stop_limit"}:
        raise ValueError(f"Unsupported order type '{request.order_type}'")
    return side, base_type


def _infer_order_kind_from_broker(order: ExecutionOrder) -> Optional[str]:
    if order.side == "sell" and order.order_type in {"stop", "stop_limit"}:
        return "stop"
    if order.side == "sell" and order.order_type == "limit":
        return "take_profit"
    return "entry"


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


def _manage_cfg_from_app() -> ManageStateConfig:
    from api.routers import config as config_router

    manage = config_router.current_config.manage
    return ManageStateConfig(
        breakeven_at_R=manage.breakeven_at_r,
        trail_sma=manage.trail_sma,
        trail_after_R=manage.trail_after_r,
        sma_buffer_pct=manage.sma_buffer_pct,
        max_holding_days=manage.max_holding_days,
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


class PortfolioService:
    def __init__(
        self,
        orders_repo: OrdersRepository,
        positions_repo: PositionsRepository,
        provider: Optional[MarketDataProvider] = None,
        execution_provider: Optional[ExecutionProvider] = None,
    ) -> None:
        self._orders_repo = orders_repo
        self._positions_repo = positions_repo
        self._provider = provider or get_default_provider()
        self._execution_provider = execution_provider

    def _broker_enabled(self) -> bool:
        return self._execution_provider is not None

    def _source_provider_name(self) -> str:
        if self._execution_provider is not None:
            return self._execution_provider.get_provider_name()
        return "local"

    def _broker_order_to_api_order(self, order: ExecutionOrder) -> Order:
        order_date = order.submitted_at[:10] if order.submitted_at else ""
        filled_date = order.filled_at[:10] if order.filled_at else ""
        ticker = _normalize_ticker(order.ticker)
        position_id = _position_id_for_ticker(ticker) if order.side == "sell" else None
        return Order(
            order_id=order.order_id,
            ticker=ticker,
            status=_broker_to_api_order_status(order.status),
            order_type=_broker_to_api_order_type(order.side, order.order_type),
            quantity=max(0, int(round(order.quantity))),
            limit_price=order.limit_price,
            stop_price=order.stop_price,
            order_date=order_date,
            filled_date=filled_date,
            entry_price=order.avg_fill_price,
            notes=f"broker_status={order.raw_status}" if order.raw_status else "",
            order_kind=_infer_order_kind_from_broker(order),  # type: ignore[arg-type]
            parent_order_id=None,
            position_id=position_id,
            tif=str(order.tif or "gtc").upper(),
            fee_eur=None,
            fill_fx_rate=None,
            broker_provider=self._execution_provider.get_provider_name() if self._execution_provider else None,
            broker_order_id=order.order_id,
            broker_status=order.raw_status or order.status,
            broker_updated_at=order.submitted_at,
            broker_client_order_id=order.client_order_id,
        )

    def _broker_position_payloads(self) -> tuple[list[dict], dict[str, float], str]:
        if not self._execution_provider:
            return [], {}, get_today_str()

        broker_positions = self._execution_provider.list_positions()
        broker_orders = self._execution_provider.list_orders(status=None, ticker=None)

        stop_prices: dict[str, float] = {}
        stop_order_ids: dict[str, list[str]] = defaultdict(list)
        entry_by_symbol: dict[str, tuple[str, str]] = {}

        for order in broker_orders:
            symbol = _normalize_ticker(order.ticker)
            if not symbol:
                continue
            if order.side == "sell" and order.status == "pending" and order.order_type in {"stop", "stop_limit"}:
                if order.stop_price is not None:
                    existing = stop_prices.get(symbol)
                    if existing is None or order.stop_price > existing:
                        stop_prices[symbol] = float(order.stop_price)
                    stop_order_ids[symbol].append(order.order_id)
            if order.side == "buy" and order.status == "filled":
                candidate_date = ""
                if order.filled_at:
                    candidate_date = order.filled_at[:10]
                elif order.submitted_at:
                    candidate_date = order.submitted_at[:10]
                existing = entry_by_symbol.get(symbol)
                # Keep latest known entry date.
                if existing is None or candidate_date >= existing[0]:
                    entry_by_symbol[symbol] = (candidate_date, order.order_id)

        payloads: list[dict] = []
        current_prices: dict[str, float] = {}
        for broker_pos in broker_positions:
            symbol = _normalize_ticker(broker_pos.ticker)
            if not symbol:
                continue
            qty = max(0, int(round(float(broker_pos.quantity))))
            if qty <= 0:
                continue

            current_price = (
                float(broker_pos.current_price)
                if broker_pos.current_price is not None
                else float(broker_pos.avg_entry_price)
            )
            current_prices[symbol] = current_price
            entry_info = entry_by_symbol.get(symbol)
            payloads.append(
                {
                    "ticker": symbol,
                    "status": "open",
                    "entry_date": entry_info[0] if entry_info else "",
                    "entry_price": float(broker_pos.avg_entry_price),
                    "stop_price": float(stop_prices.get(symbol, 0.0)),
                    "shares": qty,
                    "position_id": _position_id_for_ticker(symbol),
                    "source_order_id": entry_info[1] if entry_info else None,
                    "initial_risk": None,
                    "max_favorable_price": None,
                    "exit_date": None,
                    "exit_price": None,
                    "current_price": current_price,
                    "notes": f"source={self._execution_provider.get_provider_name()}",
                    "exit_order_ids": stop_order_ids.get(symbol, []),
                }
            )

        return payloads, current_prices, get_today_str()

    def _fetch_last_prices(self, tickers: list[str]) -> dict[str, float]:
        if not tickers:
            return {}

        start_date = get_default_backtest_start()
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
                # Known data access errors - log and continue with null prices
                logger.warning("Failed to fetch current prices (data error): %s", exc)
                for pos in positions:
                    if pos.get("status") == "open":
                        pos["current_price"] = None
            except Exception as exc:
                # Unexpected errors - log with full context but continue
                logger.exception("Unexpected error fetching current prices")
                for pos in positions:
                    if pos.get("status") == "open":
                        pos["current_price"] = None

        return last_prices

    def _fee_map_by_position_id(self) -> dict[str, float]:
        fees: dict[str, float] = {}
        try:
            orders = load_orders(self._orders_repo.path)
            for order in orders:
                if order.status != "filled":
                    continue
                if not order.position_id:
                    continue
                if order.fee_eur is None:
                    continue
                fee_value = abs(float(order.fee_eur))
                fees[order.position_id] = fees.get(order.position_id, 0.0) + fee_value
        except Exception as exc:
            logger.warning("Failed to load order fees: %s", exc)
        return fees

    def _eurusd_rate(self) -> float:
        """Fetch EURUSD rate with simple caching to avoid redundant API calls."""
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
            logger.warning("Failed to fetch EURUSD fx rate for fee conversion: %s", exc)
            return 1.0

    def _build_position_with_metrics(
        self,
        position: dict,
        current_prices: dict[str, float],
        fee_map: dict[str, float],
        eurusd_rate: float,
    ) -> PositionWithMetrics:
        state_position = _to_state_position(position)
        ticker = state_position.ticker.upper()
        # Live price from provider (may be None / missing)
        live_price = current_prices.get(ticker)
        # Effective price for metrics: fall back if live price is unavailable
        current_price_for_metrics = live_price if live_price is not None else self._fallback_price(position)
        per_share_risk = calculate_per_share_risk(state_position)
        fees_eur = fee_map.get(state_position.position_id or "", 0.0)
        position_ccy = detect_currency(ticker)
        if position_ccy == "EUR":
            fee_in_quote_ccy = fees_eur
        elif position_ccy == "USD":
            fee_in_quote_ccy = fees_eur * eurusd_rate
        else:
            logger.warning(
                "Unexpected currency '%s' detected for ticker '%s' when converting fees; "
                "using raw EUR fee amount without FX conversion.",
                position_ccy,
                ticker,
            )
            fee_in_quote_ccy = fees_eur
        pnl = calculate_pnl(state_position.entry_price, current_price_for_metrics, state_position.shares) - fee_in_quote_ccy
        entry_value = calculate_total_position_value(state_position.entry_price, state_position.shares)
        pnl_percent = (pnl / entry_value * 100.0) if entry_value > 0 else 0.0

        payload = dict(position)
        # Only expose current_price in the API payload when we have a live quote
        if state_position.status == "open" and live_price is not None:
            payload["current_price"] = live_price

        return PositionWithMetrics(
            **payload,
            pnl=pnl,
            fees_eur=fees_eur,
            pnl_percent=pnl_percent,
            r_now=calculate_r_now(state_position, current_price_for_metrics),
            entry_value=entry_value,
            current_value=calculate_current_position_value(current_price_for_metrics, state_position.shares),
            per_share_risk=per_share_risk,
            total_risk=per_share_risk * state_position.shares,
        )

    def list_positions(self, status: Optional[str] = None) -> PositionsWithMetricsResponse:
        if self._broker_enabled():
            if status and status != "open":
                return PositionsWithMetricsResponse(positions=[], asof=get_today_str())
            positions, current_prices, asof = self._broker_position_payloads()
        else:
            positions, asof = self._positions_repo.list_positions(status=status)
            current_prices = self._attach_live_prices(positions)

        fee_map = {} if self._broker_enabled() else self._fee_map_by_position_id()
        has_usd_positions = any(
            detect_currency(str(position.get("ticker", "")).upper()) == "USD"
            for position in positions
        )
        eurusd_rate = self._eurusd_rate() if has_usd_positions else 1.0

        positions_with_metrics = [
            self._build_position_with_metrics(position, current_prices, fee_map, eurusd_rate)
            for position in positions
        ]
        return PositionsWithMetricsResponse(positions=positions_with_metrics, asof=asof)

    def sync_broker_state(self, persist_projection: bool = False) -> PortfolioSyncResponse:
        if not self._broker_enabled():
            raise HTTPException(
                status_code=400,
                detail="sync is only available when SWING_SCREENER_EXECUTION_PROVIDER is enabled.",
            )

        positions, _, asof = self._broker_position_payloads()
        broker_orders = self._execution_provider.list_orders(status=None, ticker=None)
        orders = [self._broker_order_to_api_order(order).model_dump() for order in broker_orders]

        if persist_projection:
            self._positions_repo.write({"asof": asof, "positions": positions})
            self._orders_repo.write({"asof": asof, "orders": orders})

        return PortfolioSyncResponse(
            status="ok",
            provider=self._source_provider_name(),
            asof=asof,
            positions=len(positions),
            orders=len(orders),
            persisted_projection=persist_projection,
        )

    def export_portfolio_state(self) -> PortfolioExportResponse:
        positions_response = self.list_positions(status="open")
        orders_response = self.list_orders(status=None, ticker=None)
        return PortfolioExportResponse(
            provider=self._source_provider_name(),
            asof=positions_response.asof,
            positions=positions_response.positions,
            orders=orders_response.orders,
            counts={
                "positions": len(positions_response.positions),
                "orders": len(orders_response.orders),
            },
        )

    def get_position(self, position_id: str) -> Position:
        if self._broker_enabled():
            ticker = _ticker_from_position_id(position_id)
            positions, _, _ = self._broker_position_payloads()
            position = next(
                (p for p in positions if _normalize_ticker(p.get("ticker", "")) == ticker),
                None,
            )
        else:
            position = self._positions_repo.get_position(position_id)
        if position is None:
            raise HTTPException(status_code=404, detail=f"Position not found: {position_id}")
        return Position(**position)

    def get_position_metrics(self, position_id: str) -> PositionMetrics:
        if self._broker_enabled():
            ticker = _ticker_from_position_id(position_id)
            positions, current_prices, _ = self._broker_position_payloads()
            position = next(
                (p for p in positions if _normalize_ticker(p.get("ticker", "")) == ticker),
                None,
            )
            fee_map: dict[str, float] = {}
        else:
            position = self._positions_repo.get_position(position_id)
            current_prices = {}
            fee_map = self._fee_map_by_position_id()
        if position is None:
            raise HTTPException(status_code=404, detail=f"Position not found: {position_id}")

        ticker = str(position.get("ticker", "")).upper()
        current_price = self._fallback_price(position)

        if self._broker_enabled():
            current_price = current_prices.get(ticker, current_price)
        elif position.get("status") == "open" and ticker:
            try:
                current_price = self._fetch_last_prices([ticker]).get(ticker, current_price)
            except Exception as exc:
                logger.warning("Failed to fetch current price for %s metrics: %s", ticker, exc)

        state_position = _to_state_position(position)
        fees_eur = fee_map.get(state_position.position_id or "", 0.0)
        ticker_currency = detect_currency(ticker)
        eurusd_rate = self._eurusd_rate() if ticker_currency == "USD" else 1.0
        fee_in_quote_ccy = fees_eur if ticker_currency == "EUR" else fees_eur * eurusd_rate
        pnl = calculate_pnl(state_position.entry_price, current_price, state_position.shares) - fee_in_quote_ccy
        per_share_risk = calculate_per_share_risk(state_position)
        entry_value = calculate_total_position_value(state_position.entry_price, state_position.shares)
        pnl_percent = (pnl / entry_value * 100.0) if entry_value > 0 else 0.0

        return PositionMetrics(
            ticker=ticker,
            pnl=pnl,
            fees_eur=fees_eur,
            pnl_percent=pnl_percent,
            r_now=calculate_r_now(state_position, current_price),
            entry_value=entry_value,
            current_value=calculate_current_position_value(current_price, state_position.shares),
            per_share_risk=per_share_risk,
            total_risk=per_share_risk * state_position.shares,
        )

    def get_portfolio_summary(self, account_size: float) -> PortfolioSummary:
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
                available_capital=account_size,
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
        open_risk_percent = (open_risk / account_size * 100.0) if account_size > 0 else 0.0
        avg_r_now = (total_r_now / r_count) if r_count > 0 else 0.0
        win_rate = (positions_profitable / len(positions) * 100.0) if positions else 0.0

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
            available_capital=account_size - total_value,
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
        )

    def update_position_stop(self, position_id: str, request: UpdateStopRequest) -> dict:
        if self._broker_enabled():
            ticker = _ticker_from_position_id(position_id)
            positions, _, _ = self._broker_position_payloads()
            position = next(
                (p for p in positions if _normalize_ticker(p.get("ticker", "")) == ticker),
                None,
            )
            if position is None:
                raise HTTPException(status_code=404, detail=f"Position not found: {position_id}")

            if position.get("status") != "open":
                raise HTTPException(status_code=400, detail="Cannot update stop on closed position")

            old_stop = float(position.get("stop_price", 0.0) or 0.0)
            entry_price = float(position.get("entry_price", 0.0) or 0.0)
            shares = int(position.get("shares", 0) or 0)
            new_stop = request.new_stop

            if old_stop > 0 and new_stop <= old_stop:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot move stop down. Current: {old_stop}, Requested: {new_stop}",
                )
            if entry_price and new_stop >= entry_price:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stop price ({new_stop}) must be below entry price ({entry_price}) for long positions",
                )
            if shares <= 0:
                raise HTTPException(status_code=400, detail=f"Invalid position quantity for {ticker}: {shares}")

            # Optional warning validation against latest daily close.
            try:
                end_date = get_today_str()
                start_date = (pd.Timestamp(end_date) - pd.Timedelta(days=5)).strftime("%Y-%m-%d")
                ohlcv = self._provider.fetch_ohlcv([ticker], start_date=start_date, end_date=end_date)
                if not ohlcv.empty and ticker in ohlcv.columns.get_level_values(1):
                    current_price = ohlcv[("Close", ticker)].iloc[-1]
                    if not pd.isna(current_price) and new_stop > float(current_price) * 1.1:
                        logger.warning(
                            "Stop price %s is >10%% above current price %s for %s",
                            new_stop,
                            current_price,
                            ticker,
                        )
            except Exception as exc:
                logger.warning("Could not fetch current price for validation: %s", exc)

            cancelled_order_ids: list[str] = []
            pending_orders = self._execution_provider.list_orders(status="pending", ticker=ticker)
            for order in pending_orders:
                if order.side == "sell" and order.order_type in {"stop", "stop_limit"}:
                    try:
                        self._execution_provider.cancel_order(order.order_id)
                        cancelled_order_ids.append(order.order_id)
                    except Exception as exc:
                        logger.warning("Failed cancelling stop order %s for %s: %s", order.order_id, ticker, exc)

            client_order_id = f"STOP-{ticker}-{dt.datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
            submitted = self._execution_provider.submit_order(
                SubmitOrderRequest(
                    ticker=ticker,
                    side="sell",
                    order_type="stop",
                    quantity=float(shares),
                    tif="gtc",
                    stop_price=float(new_stop),
                    client_order_id=client_order_id,
                )
            )

            return {
                "status": "ok",
                "position_id": position_id,
                "new_stop": new_stop,
                "old_stop": old_stop,
                "cancelled_orders": cancelled_order_ids,
                "new_order_id": submitted.order_id,
                "broker_provider": self._execution_provider.get_provider_name(),
                "broker_order_id": submitted.order_id,
            }

        data = self._positions_repo.read()
        positions = data.get("positions", [])
        found = False
        ticker = None
        shares = None
        old_stop = None
        new_stop = request.new_stop

        for pos in positions:
            if pos.get("position_id") == position_id:
                if pos.get("status") != "open":
                    raise HTTPException(status_code=400, detail="Cannot update stop on closed position")

                old_stop = pos.get("stop_price")
                entry_price = pos.get("entry_price")
                ticker = pos.get("ticker")
                shares = pos.get("shares")
                
                # Validation: stop must move up only (trailing stop)
                if new_stop <= old_stop:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot move stop down. Current: {old_stop}, Requested: {new_stop}",
                    )
                
                # Validation: stop must not exceed entry (for long positions).
                # Breakeven stop at entry is valid and expected by manage rules.
                if entry_price and new_stop > entry_price:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Stop price ({new_stop}) must be at or below entry price ({entry_price}) for long positions"
                    )
                
                # Optional: fetch current price and validate stop is reasonable
                try:
                    end_date = get_today_str()
                    start_date = (pd.Timestamp(end_date) - pd.Timedelta(days=5)).strftime("%Y-%m-%d")
                    ohlcv = self._provider.fetch_ohlcv([ticker], start_date=start_date, end_date=end_date)
                    if not ohlcv.empty and ticker in ohlcv.columns.get_level_values(1):
                        current_price = ohlcv[("Close", ticker)].iloc[-1]
                        if not pd.isna(current_price):
                            # Warn if stop is way above current price
                            if new_stop > current_price * 1.1:
                                logger.warning(
                                    f"Stop price {new_stop} is >10% above current price {current_price} for {ticker}"
                                )
                except Exception as exc:
                    logger.warning(f"Could not fetch current price for validation: {exc}")

                # Update position stop
                pos["stop_price"] = new_stop
                if request.reason:
                    current_notes = pos.get("notes", "")
                    pos["notes"] = f"{current_notes}\nStop updated to {new_stop}: {request.reason}".strip()

                found = True
                break

        if not found:
            raise HTTPException(status_code=404, detail=f"Position not found: {position_id}")

        # Sync stop orders: Cancel old SELL_STOP orders and create new one
        orders_data = self._orders_repo.read()
        orders = orders_data.get("orders", [])
        cancelled_order_ids = []
        new_order_id = None

        # Find and cancel existing SELL_STOP orders for this position
        for order in orders:
            if (order.get("position_id") == position_id and 
                order.get("order_kind") == "stop" and
                order.get("status") == "pending"):
                
                # Cancel the old stop order
                order["status"] = "cancelled"
                cancel_reason = f"Replaced with new stop at {new_stop} (was {old_stop})"
                order["notes"] = f"{order.get('notes', '')}\n{cancel_reason}".strip()
                cancelled_order_ids.append(order.get("order_id"))
                logger.info(f"Cancelled stop order {order.get('order_id')} for position {position_id}")

        # Create new SELL_STOP order
        if ticker and shares:
            import uuid
            new_order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
            new_order = {
                "order_id": new_order_id,
                "ticker": ticker,
                "status": "pending",
                "order_type": "STOP",
                "quantity": shares,
                "stop_price": new_stop,
                "order_date": get_today_str(),
                "notes": f"Auto-created from position stop update (was {old_stop})",
                "order_kind": "stop",
                "position_id": position_id,
                "tif": "GTC",  # Good Till Cancelled
            }
            orders.append(new_order)
            logger.info(f"Created new stop order {new_order_id} at {new_stop} for position {position_id}")

            # Update position's exit_order_ids
            for pos in positions:
                if pos.get("position_id") == position_id:
                    exit_order_ids = pos.get("exit_order_ids", [])
                    if not isinstance(exit_order_ids, list):
                        exit_order_ids = []
                    # Add new order, keep old ones for history
                    if new_order_id not in exit_order_ids:
                        exit_order_ids.append(new_order_id)
                    pos["exit_order_ids"] = exit_order_ids
                    break

        # Save both positions and orders
        data["asof"] = get_today_str()
        self._positions_repo.write(data)
        
        orders_data["orders"] = orders
        orders_data["asof"] = get_today_str()
        self._orders_repo.write(orders_data)

        return {
            "status": "ok",
            "position_id": position_id,
            "new_stop": new_stop,
            "old_stop": old_stop,
            "cancelled_orders": cancelled_order_ids,
            "new_order_id": new_order_id,
        }

    def close_position(self, position_id: str, request: ClosePositionRequest) -> dict:
        if self._broker_enabled():
            ticker = _ticker_from_position_id(position_id)
            position = self._execution_provider.get_open_position(ticker)
            if position is None:
                raise HTTPException(status_code=404, detail=f"Position not found: {position_id}")
            shares = max(0, int(round(position.quantity)))
            if shares <= 0:
                raise HTTPException(status_code=400, detail=f"Invalid position quantity for {ticker}: {shares}")

            close_order = self._execution_provider.submit_order(
                SubmitOrderRequest(
                    ticker=ticker,
                    side="sell",
                    order_type="market",
                    quantity=float(shares),
                    tif="day",
                    client_order_id=f"CLOSE-{ticker}-{dt.datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                )
            )
            return {
                "status": "ok",
                "position_id": position_id,
                "exit_price": request.exit_price,
                "close_order_id": close_order.order_id,
                "broker_provider": self._execution_provider.get_provider_name(),
                "broker_order_id": close_order.order_id,
            }

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
                if request.reason:
                    current_notes = pos.get("notes", "")
                    pos["notes"] = f"{current_notes}\nClosed: {request.reason}".strip()

                found = True
                break

        if not found:
            raise HTTPException(status_code=404, detail=f"Position not found: {position_id}")

        data["asof"] = get_today_str()
        self._positions_repo.write(data)

        return {"status": "ok", "position_id": position_id, "exit_price": request.exit_price}

    def suggest_position_stop(self, position_id: str) -> PositionUpdate:
        try:
            position = self.get_position(position_id).model_dump()
        except HTTPException:
            raise

        if position.get("status") != "open":
            raise HTTPException(status_code=400, detail="Stop suggestions require an open position")

        ticker = position.get("ticker")
        if not ticker:
            raise HTTPException(status_code=400, detail="Position ticker is missing")

        manage_cfg = _manage_cfg_from_app()
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

    def list_orders(self, status: Optional[str] = None, ticker: Optional[str] = None) -> OrdersResponse:
        if self._broker_enabled():
            normalized_status = None
            if status:
                status_l = status.strip().lower()
                if status_l in {"pending", "filled", "cancelled"}:
                    normalized_status = status_l
            broker_orders = self._execution_provider.list_orders(status=normalized_status, ticker=ticker)
            orders = [self._broker_order_to_api_order(order) for order in broker_orders]
            return OrdersResponse(
                orders=[order.model_dump() for order in orders],
                asof=get_today_str(),
            )

        orders, asof = self._orders_repo.list_orders(status=status, ticker=ticker)
        return OrdersResponse(orders=orders, asof=asof)

    def list_order_snapshots(self, status: Optional[str] = "pending") -> OrdersSnapshotResponse:
        if self._broker_enabled():
            normalized_status = None
            if status:
                status_l = status.strip().lower()
                if status_l in {"pending", "filled", "cancelled"}:
                    normalized_status = status_l
            broker_orders = self._execution_provider.list_orders(status=normalized_status, ticker=None)
            orders = [self._broker_order_to_api_order(order).model_dump() for order in broker_orders]
            asof = get_today_str()
        else:
            data = self._orders_repo.read()
            orders = data.get("orders", [])

            if status:
                orders = [o for o in orders if o.get("status") == status]

            asof = data.get("asof", get_today_str())

        if not orders:
            return OrdersSnapshotResponse(orders=[], asof=asof)

        tickers = list({o.get("ticker", "").upper() for o in orders if o.get("ticker")})
        last_prices: dict[str, float] = {}
        last_bars: dict[str, str] = {}

        if tickers:
            try:
                start_date = get_default_backtest_start()
                end_date = get_today_str()
                ohlcv = self._provider.fetch_ohlcv(tickers, start_date=start_date, end_date=end_date)
                last_prices, last_bars = _last_close_map(ohlcv)
            except Exception as exc:
                logger.warning("Failed to fetch order snapshot prices: %s", exc)

        snapshots: list[OrderSnapshot] = []
        for order in orders:
            ticker = order.get("ticker", "").upper()
            last_price = last_prices.get(ticker)
            last_bar = last_bars.get(ticker)
            limit_price = order.get("limit_price")
            stop_price = order.get("stop_price")

            snapshots.append(
                OrderSnapshot(
                    order_id=order.get("order_id", ""),
                    ticker=ticker,
                    status=order.get("status", ""),
                    order_type=order.get("order_type", ""),
                    quantity=order.get("quantity", 0),
                    limit_price=limit_price,
                    stop_price=stop_price,
                    order_kind=order.get("order_kind"),
                    last_price=last_price,
                    last_bar=last_bar,
                    pct_to_limit=_pct_to_target(limit_price, last_price),
                    pct_to_stop=_pct_to_target(stop_price, last_price),
                )
            )

        return OrdersSnapshotResponse(orders=snapshots, asof=asof)

    def get_order(self, order_id: str) -> Order:
        if self._broker_enabled():
            try:
                broker_order = self._execution_provider.get_order(order_id)
            except Exception as exc:
                raise HTTPException(status_code=404, detail=f"Order not found: {order_id}") from exc
            return self._broker_order_to_api_order(broker_order)

        order = self._orders_repo.get_order(order_id)
        if order is None:
            raise HTTPException(status_code=404, detail=f"Order not found: {order_id}")
        return Order(**order)

    def create_order(self, request: CreateOrderRequest) -> Order:
        if self._broker_enabled():
            try:
                side, broker_type = _api_to_broker_order_params(request)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc

            client_order_id = f"CLI-{request.ticker.upper()}-{dt.datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
            try:
                broker_order = self._execution_provider.submit_order(
                    SubmitOrderRequest(
                        ticker=request.ticker.upper(),
                        side=side,  # type: ignore[arg-type]
                        order_type=broker_type,  # type: ignore[arg-type]
                        quantity=float(request.quantity),
                        tif="gtc",
                        limit_price=request.limit_price,
                        stop_price=request.stop_price,
                        client_order_id=client_order_id,
                    )
                )
            except Exception as exc:
                raise HTTPException(status_code=502, detail=f"Broker order submission failed: {exc}") from exc

            return self._broker_order_to_api_order(broker_order)

        data = self._orders_repo.read()

        ticker = request.ticker.upper()
        timestamp = dt.datetime.now().strftime("%Y%m%d%H%M%S")
        order_id = f"{ticker}-{timestamp}"

        new_order = {
            "order_id": order_id,
            "ticker": ticker,
            "status": "pending",
            "order_type": request.order_type,
            "quantity": request.quantity,
            "limit_price": request.limit_price,
            "stop_price": request.stop_price,
            "order_date": get_today_str(),
            "filled_date": "",
            "entry_price": None,
            "notes": request.notes,
            "order_kind": request.order_kind,
            "parent_order_id": None,
            "position_id": None,
            "tif": "GTC",
            "fee_eur": None,
            "fill_fx_rate": None,
        }

        orders = data.get("orders", [])
        orders.append(new_order)
        data["orders"] = orders
        data["asof"] = get_today_str()

        self._orders_repo.write(data)
        return Order(**new_order)

    def fill_order(self, order_id: str, request: FillOrderRequest) -> dict:
        if self._broker_enabled():
            order = self._execution_provider.get_order(order_id)
            if order.status != "filled":
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Order {order_id} is not filled on broker yet (status={order.raw_status or order.status}). "
                        "Fills are broker-driven in execution provider mode."
                    ),
                )
            return {
                "status": "ok",
                "order_id": order_id,
                "filled_price": order.avg_fill_price,
                "filled_date": order.filled_at[:10] if order.filled_at else "",
                "broker_provider": self._execution_provider.get_provider_name(),
                "broker_order_id": order_id,
            }

        orders_path = self._orders_repo.path
        positions_path = self._positions_repo.path

        orders = load_orders(orders_path)
        orders, normalized = normalize_orders(orders)
        if normalized:
            save_orders(orders_path, orders, asof=get_today_str())

        positions = load_positions(positions_path)

        order = next((o for o in orders if o.order_id == order_id), None)
        if order is None:
            raise HTTPException(status_code=404, detail=f"Order not found: {order_id}")
        if order.status != "pending":
            raise HTTPException(status_code=400, detail=f"Order not pending: {order.status}")

        kind = infer_order_kind(order)
        if kind == "entry":
            stop_price = request.stop_price if request.stop_price is not None else order.stop_price
            if stop_price is None:
                raise HTTPException(status_code=400, detail="stop_price is required for entry fills")
            if order.quantity <= 0:
                raise HTTPException(status_code=400, detail="Order quantity must be > 0")

            new_orders, new_positions = fill_entry_order(
                orders,
                positions,
                order_id=order_id,
                fill_price=request.filled_price,
                fill_date=request.filled_date,
                quantity=order.quantity,
                stop_price=stop_price,
                tp_price=None,
                fee_eur=request.fee_eur,
                fill_fx_rate=request.fill_fx_rate,
            )
            save_orders(orders_path, new_orders, asof=get_today_str())
            save_positions(positions_path, new_positions, asof=get_today_str())
            position_id = next(
                (p.position_id for p in new_positions if p.source_order_id == order_id),
                None,
            )
            return {
                "status": "ok",
                "order_id": order_id,
                "filled_price": request.filled_price,
                "position_id": position_id,
            }

        for idx, o in enumerate(orders):
            if o.order_id == order_id:
                orders[idx] = replace(
                    o,
                    status="filled",
                    filled_date=request.filled_date,
                    entry_price=request.filled_price,
                    fee_eur=request.fee_eur,
                    fill_fx_rate=request.fill_fx_rate,
                )
                break

        save_orders(orders_path, orders, asof=get_today_str())
        return {"status": "ok", "order_id": order_id, "filled_price": request.filled_price}

    def cancel_order(self, order_id: str) -> dict:
        if self._broker_enabled():
            try:
                self._execution_provider.cancel_order(order_id)
            except Exception as exc:
                raise HTTPException(status_code=502, detail=f"Broker cancel failed for {order_id}: {exc}") from exc
            return {
                "status": "ok",
                "order_id": order_id,
                "broker_provider": self._execution_provider.get_provider_name(),
                "broker_order_id": order_id,
            }

        data = self._orders_repo.read()
        orders = data.get("orders", [])
        found = False

        for order in orders:
            if order.get("order_id") == order_id:
                if order.get("status") != "pending":
                    raise HTTPException(status_code=400, detail=f"Order not pending: {order.get('status')}")

                order["status"] = "cancelled"
                found = True
                break

        if not found:
            raise HTTPException(status_code=404, detail=f"Order not found: {order_id}")

        data["asof"] = get_today_str()
        self._orders_repo.write(data)
        return {"status": "ok", "order_id": order_id}
