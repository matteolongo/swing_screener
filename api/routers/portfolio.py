"""Portfolio router - Positions and Orders CRUD."""
from __future__ import annotations

from typing import Optional
from dataclasses import replace
from fastapi import APIRouter, HTTPException
import datetime as dt
import logging
import pandas as pd

from api.models import (
    Position,
    Order,
    PositionsResponse,
    OrdersResponse,
    OrderSnapshot,
    OrdersSnapshotResponse,
    CreateOrderRequest,
    FillOrderRequest,
    UpdateStopRequest,
    ClosePositionRequest,
)
from api.dependencies import (
    get_positions_path,
    get_orders_path,
    read_json_file,
    write_json_file,
    get_today_str,
)

from swing_screener.portfolio.state import load_positions, save_positions
from swing_screener.execution.orders import load_orders, save_orders
from swing_screener.execution.order_workflows import (
    fill_entry_order,
    infer_order_kind,
    normalize_orders,
)
from swing_screener.execution.orders import Order as CoreOrder
from swing_screener.data.market_data import fetch_ohlcv, MarketDataConfig

router = APIRouter()
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


# ===== Positions =====

@router.get("/positions", response_model=PositionsResponse)
async def get_positions(status: Optional[str] = None):
    """Get all positions, optionally filtered by status."""
    path = get_positions_path()
    data = read_json_file(path)
    
    positions = data.get("positions", [])
    
    # Filter by status if requested
    if status:
        positions = [p for p in positions if p.get("status") == status]
    
    # Fetch current prices for open positions
    open_positions = [p for p in positions if p.get("status") == "open"]
    if open_positions:
        try:
            tickers = list(set([p["ticker"] for p in open_positions]))
            cfg = MarketDataConfig(
                start="2025-01-01",  # Last year of data
                end=get_today_str(),
                auto_adjust=True,
                progress=False,
            )
            ohlcv = fetch_ohlcv(tickers, cfg)
            
            # Get latest close price for each ticker
            latest_date = ohlcv.index.max()
            for pos in positions:
                if pos.get("status") == "open":
                    try:
                        price = ohlcv.loc[latest_date, ("Close", pos["ticker"])]
                        pos["current_price"] = float(price) if not pd.isna(price) else None
                    except (KeyError, IndexError):
                        pos["current_price"] = None
        except Exception as e:
            # If price fetch fails, continue without current_price
            logger.warning("Failed to fetch current prices: %s", e)
            for pos in positions:
                if pos.get("status") == "open":
                    pos["current_price"] = None
    
    return PositionsResponse(
        positions=positions,
        asof=data.get("asof", get_today_str()),
    )


@router.get("/positions/{position_id}", response_model=Position)
async def get_position(position_id: str):
    """Get a specific position by ID."""
    path = get_positions_path()
    data = read_json_file(path)
    
    for pos in data.get("positions", []):
        if pos.get("position_id") == position_id:
            return Position(**pos)
    
    raise HTTPException(status_code=404, detail=f"Position not found: {position_id}")


@router.put("/positions/{position_id}/stop")
async def update_position_stop(position_id: str, request: UpdateStopRequest):
    """Update stop price for a position."""
    path = get_positions_path()
    data = read_json_file(path)
    
    positions = data.get("positions", [])
    found = False
    
    for pos in positions:
        if pos.get("position_id") == position_id:
            if pos.get("status") != "open":
                raise HTTPException(status_code=400, detail="Cannot update stop on closed position")
            
            old_stop = pos.get("stop_price")
            new_stop = request.new_stop
            
            # Enforce: only move stops UP (never down)
            if new_stop <= old_stop:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot move stop down. Current: {old_stop}, Requested: {new_stop}",
                )
            
            pos["stop_price"] = new_stop
            if request.reason:
                current_notes = pos.get("notes", "")
                pos["notes"] = f"{current_notes}\nStop updated to {new_stop}: {request.reason}".strip()
            
            found = True
            break
    
    if not found:
        raise HTTPException(status_code=404, detail=f"Position not found: {position_id}")
    
    # Update asof date
    data["asof"] = get_today_str()
    write_json_file(path, data)
    
    return {"status": "ok", "position_id": position_id, "new_stop": request.new_stop}


@router.post("/positions/{position_id}/close")
async def close_position(position_id: str, request: ClosePositionRequest):
    """Close a position."""
    path = get_positions_path()
    data = read_json_file(path)
    
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
    
    # Update asof date
    data["asof"] = get_today_str()
    write_json_file(path, data)
    
    return {"status": "ok", "position_id": position_id, "exit_price": request.exit_price}


# ===== Orders =====

@router.get("/orders", response_model=OrdersResponse)
async def get_orders(status: Optional[str] = None, ticker: Optional[str] = None):
    """Get all orders, optionally filtered by status or ticker."""
    path = get_orders_path()
    data = read_json_file(path)
    
    orders = data.get("orders", [])
    
    # Filter by status if requested
    if status:
        orders = [o for o in orders if o.get("status") == status]
    
    # Filter by ticker if requested
    if ticker:
        orders = [o for o in orders if o.get("ticker", "").upper() == ticker.upper()]
    
    return OrdersResponse(
        orders=orders,
        asof=data.get("asof", get_today_str()),
    )


@router.get("/orders/snapshot", response_model=OrdersSnapshotResponse)
async def get_orders_snapshot(status: Optional[str] = "pending"):
    """Get orders with latest close and distance to limit/stop."""
    path = get_orders_path()
    data = read_json_file(path)
    orders = data.get("orders", [])

    if status:
        orders = [o for o in orders if o.get("status") == status]

    if not orders:
        return OrdersSnapshotResponse(
            orders=[],
            asof=data.get("asof", get_today_str()),
        )

    tickers = list({o.get("ticker", "").upper() for o in orders if o.get("ticker")})
    last_prices: dict[str, float] = {}
    last_bars: dict[str, str] = {}

    if tickers:
        try:
            cfg = MarketDataConfig(
                start="2025-01-01",
                end=get_today_str(),
                auto_adjust=True,
                progress=False,
            )
            ohlcv = fetch_ohlcv(tickers, cfg)
            last_prices, last_bars = _last_close_map(ohlcv)
        except Exception as e:
            logger.warning("Failed to fetch order snapshot prices: %s", e)

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

    return OrdersSnapshotResponse(
        orders=snapshots,
        asof=data.get("asof", get_today_str()),
    )


@router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str):
    """Get a specific order by ID."""
    path = get_orders_path()
    data = read_json_file(path)
    
    for order in data.get("orders", []):
        if order.get("order_id") == order_id:
            return Order(**order)
    
    raise HTTPException(status_code=404, detail=f"Order not found: {order_id}")


@router.post("/orders", response_model=Order)
async def create_order(request: CreateOrderRequest):
    """Create a new order."""
    path = get_orders_path()
    data = read_json_file(path)
    
    # Generate order ID
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
    }
    
    orders = data.get("orders", [])
    orders.append(new_order)
    data["orders"] = orders
    data["asof"] = get_today_str()
    
    write_json_file(path, data)
    
    return Order(**new_order)


@router.post("/orders/{order_id}/fill")
async def fill_order(order_id: str, request: FillOrderRequest):
    """Fill an order."""
    orders_path = get_orders_path()
    positions_path = get_positions_path()

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

    # Non-entry fills just update the order status
    for idx, o in enumerate(orders):
        if o.order_id == order_id:
            orders[idx] = replace(
                o,
                status="filled",
                filled_date=request.filled_date,
                entry_price=request.filled_price,
            )
            break

    save_orders(orders_path, orders, asof=get_today_str())
    return {"status": "ok", "order_id": order_id, "filled_price": request.filled_price}


@router.delete("/orders/{order_id}")
async def cancel_order(order_id: str):
    """Cancel an order."""
    path = get_orders_path()
    data = read_json_file(path)
    
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
    write_json_file(path, data)
    
    return {"status": "ok", "order_id": order_id}
