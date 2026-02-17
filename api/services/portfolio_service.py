"""Portfolio service - positions and orders logic."""
from __future__ import annotations

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
from swing_screener.portfolio.metrics import (
    calculate_current_position_value,
    calculate_per_share_risk,
    calculate_pnl,
    calculate_r_now,
    calculate_total_position_value,
)
from swing_screener.utils.date_helpers import get_default_backtest_start

logger = logging.getLogger(__name__)


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
        provider: Optional[MarketDataProvider] = None
    ) -> None:
        self._orders_repo = orders_repo
        self._positions_repo = positions_repo
        self._provider = provider or get_default_provider()

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
        try:
            fx = self._fetch_last_prices(["EURUSD=X"])
            rate = float(fx.get("EURUSD=X", 0.0))
            return rate if rate > 0 else 1.0
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
        fee_in_quote_ccy = fees_eur if detect_currency(ticker) == "EUR" else fees_eur * eurusd_rate
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
        positions, asof = self._positions_repo.list_positions(status=status)
        current_prices = self._attach_live_prices(positions)
        fee_map = self._fee_map_by_position_id()
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
        fee_map = self._fee_map_by_position_id()
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
                
                # Validation: stop must be below entry (for long positions)
                if entry_price and new_stop >= entry_price:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Stop price ({new_stop}) must be below entry price ({entry_price}) for long positions"
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
        position = self._positions_repo.get_position(position_id)
        if position is None:
            raise HTTPException(status_code=404, detail=f"Position not found: {position_id}")
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
        orders, asof = self._orders_repo.list_orders(status=status, ticker=ticker)
        return OrdersResponse(orders=orders, asof=asof)

    def list_order_snapshots(self, status: Optional[str] = "pending") -> OrdersSnapshotResponse:
        data = self._orders_repo.read()
        orders = data.get("orders", [])

        if status:
            orders = [o for o in orders if o.get("status") == status]

        if not orders:
            return OrdersSnapshotResponse(orders=[], asof=data.get("asof", get_today_str()))

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

        return OrdersSnapshotResponse(orders=snapshots, asof=data.get("asof", get_today_str()))

    def get_order(self, order_id: str) -> Order:
        order = self._orders_repo.get_order(order_id)
        if order is None:
            raise HTTPException(status_code=404, detail=f"Order not found: {order_id}")
        return Order(**order)

    def create_order(self, request: CreateOrderRequest) -> Order:
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
