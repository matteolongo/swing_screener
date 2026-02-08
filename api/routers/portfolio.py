"""Portfolio router - Positions and Orders CRUD."""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException
from datetime import datetime
import pandas as pd

from api.models import (
    Position,
    Order,
    PositionsResponse,
    OrdersResponse,
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
from swing_screener.execution.orders import Order as CoreOrder
from swing_screener.data.market_data import fetch_ohlcv, MarketDataConfig

router = APIRouter()


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
            print(f"Warning: Failed to fetch current prices: {e}")
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
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
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
    path = get_orders_path()
    data = read_json_file(path)
    
    orders = data.get("orders", [])
    found = False
    
    for order in orders:
        if order.get("order_id") == order_id:
            if order.get("status") != "pending":
                raise HTTPException(status_code=400, detail=f"Order not pending: {order.get('status')}")
            
            order["status"] = "filled"
            order["filled_date"] = request.filled_date
            order["entry_price"] = request.filled_price
            
            found = True
            break
    
    if not found:
        raise HTTPException(status_code=404, detail=f"Order not found: {order_id}")
    
    data["asof"] = get_today_str()
    write_json_file(path, data)
    
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
