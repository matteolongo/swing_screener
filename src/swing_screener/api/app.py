from __future__ import annotations

from datetime import date
from pathlib import Path

from fastapi import FastAPI, HTTPException

from swing_screener.api.models import (
    ApplyRequest,
    HealthResponse,
    OrderPatch,
    OrdersResponse,
    PositionPatch,
    PositionsResponse,
    PreviewRequest,
    ScreeningRequest,
    ScreeningResponse,
)
from swing_screener.api.service import (
    PatchError,
    apply_patches,
    apply_to_files,
    load_orders,
    load_positions,
    preview_changes,
    run_screening_preview,
    save_orders,
    save_positions,
)


def create_app(
    orders_path: str | Path = "orders.json",
    positions_path: str | Path = "positions.json",
) -> FastAPI:
    app = FastAPI(title="Swing Screener API")
    app.state.orders_path = Path(orders_path)
    app.state.positions_path = Path(positions_path)

    @app.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse()

    @app.get("/orders", response_model=OrdersResponse)
    def get_orders() -> OrdersResponse:
        orders, asof = load_orders(app.state.orders_path)
        return OrdersResponse(asof=asof, orders=orders)

    @app.get("/positions", response_model=PositionsResponse)
    def get_positions() -> PositionsResponse:
        positions, asof = load_positions(app.state.positions_path)
        return PositionsResponse(asof=asof, positions=positions)

    @app.patch("/orders/{order_id}")
    def patch_order(order_id: str, patch: OrderPatch) -> dict:
        try:
            orders, _ = load_orders(app.state.orders_path)
            positions, _ = load_positions(app.state.positions_path)
            patch_data = patch.model_dump(exclude_none=True)
            patch_data["order_id"] = order_id
            updated_orders, updated_positions = apply_patches(
                orders, positions, order_patches=[patch_data]
            )
            today = date.today().isoformat()
            save_orders(app.state.orders_path, updated_orders, asof=today)
            save_positions(app.state.positions_path, updated_positions, asof=today)
            updated = next(o for o in updated_orders if o.get("order_id") == order_id)
            return updated
        except StopIteration as exc:
            raise HTTPException(status_code=404, detail="Order not found.") from exc
        except PatchError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.patch("/positions/{ticker}")
    def patch_position(ticker: str, patch: PositionPatch) -> dict:
        try:
            orders, _ = load_orders(app.state.orders_path)
            positions, _ = load_positions(app.state.positions_path)
            patch_data = patch.model_dump(exclude_none=True)
            patch_data["ticker"] = ticker
            updated_orders, updated_positions = apply_patches(
                orders, positions, position_patches=[patch_data]
            )
            today = date.today().isoformat()
            save_orders(app.state.orders_path, updated_orders, asof=today)
            save_positions(app.state.positions_path, updated_positions, asof=today)
            updated = next(p for p in updated_positions if p.get("ticker") == ticker)
            return updated
        except StopIteration as exc:
            raise HTTPException(status_code=404, detail="Position not found.") from exc
        except PatchError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/preview")
    def preview(request: PreviewRequest) -> dict:
        try:
            orders, _ = load_orders(app.state.orders_path)
            positions, _ = load_positions(app.state.positions_path)
            return preview_changes(
                orders,
                positions,
                order_patches=[o.model_dump(exclude_none=True) for o in request.orders],
                position_patches=[p.model_dump(exclude_none=True) for p in request.positions],
            )
        except PatchError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/apply")
    def apply(request: ApplyRequest) -> dict:
        try:
            return apply_to_files(
                app.state.orders_path,
                app.state.positions_path,
                order_patches=[o.model_dump(exclude_none=True) for o in request.orders],
                position_patches=[p.model_dump(exclude_none=True) for p in request.positions],
            )
        except PatchError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/screening/run", response_model=ScreeningResponse)
    def screening_run(request: ScreeningRequest) -> ScreeningResponse:
        report, csv_text = run_screening_preview(
            universe=request.universe,
            top_n=request.top_n,
            account_size=request.account_size,
            risk_pct=request.risk_pct,
            k_atr=request.k_atr,
            max_position_pct=request.max_position_pct,
            use_cache=request.use_cache,
            force_refresh=request.force_refresh,
            min_price=request.min_price,
            max_price=request.max_price,
            max_atr_pct=request.max_atr_pct,
            require_trend_ok=request.require_trend_ok,
        )
        report = report.reset_index()
        return ScreeningResponse(
            rows=report.to_dict(orient="records"),
            columns=list(report.columns),
            csv=csv_text,
        )

    return app


app = create_app()
