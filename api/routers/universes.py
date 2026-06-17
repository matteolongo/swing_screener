from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from swing_screener.data.symbol_discovery import (
    DiscoveryProvider,
    SymbolDiscoveryError,
    SymbolDiscoveryQuery,
    discover_symbols,
)
from swing_screener.data.auto_universe import (
    AutoUniverseFilter,
    AutoUniverseRequest,
    materialize_auto_universe,
)
from swing_screener.data.universe import (
    get_package_universe_detail,
    list_package_universe_entries,
    refresh_package_universe,
    update_package_universe_benchmark,
)
from swing_screener.data.universe_sources import UniverseSourceError


router = APIRouter()


class UniverseRefreshRequest(BaseModel):
    apply: bool = False


class UniverseBenchmarkRequest(BaseModel):
    benchmark: str


class SymbolDiscoveryRequest(BaseModel):
    provider: DiscoveryProvider = "yahoo_predefined"
    screens: list[str] = Field(default_factory=lambda: ["most_actives", "day_gainers", "day_losers"])
    exchanges: list[str] = Field(default_factory=list)
    currencies: list[str] = Field(default_factory=list)
    exchange_mics: list[str] = Field(default_factory=list)
    quote_types: list[str] = Field(default_factory=lambda: ["EQUITY"])
    limit: int = 100
    min_market_cap: int | None = None
    min_volume: int | None = None


class AutoUniverseRefreshRequest(SymbolDiscoveryRequest):
    universe_id: str = "auto_liquid_supported"
    description: str = "Auto-curated liquid supported symbols"
    benchmark: str = "SPY"
    apply: bool = False
    min_price: float | None = None
    max_price: float | None = None
    exclude_symbols: list[str] = Field(default_factory=list)
    pinned_symbols: list[str] = Field(default_factory=list)


@router.get("")
async def list_universes():
    try:
        return {"universes": list_package_universe_entries()}
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to list universes") from exc


@router.post("/discover")
def discover_universe_symbols(request: SymbolDiscoveryRequest):
    try:
        query = SymbolDiscoveryQuery(
            provider=request.provider,
            screens=tuple(request.screens),
            exchanges=tuple(request.exchanges),
            currencies=tuple(request.currencies),
            exchange_mics=tuple(request.exchange_mics),
            quote_types=tuple(request.quote_types),
            limit=request.limit,
            min_market_cap=request.min_market_cap,
            min_volume=request.min_volume,
        )
        result = discover_symbols(query)
        return {
            "provider": result.provider,
            "source_asof": result.source_asof,
            "source_documents": result.source_documents,
            "filters": result.filters,
            "symbols": result.symbols,
            "taxonomy": result.taxonomy,
            "notes": result.notes,
        }
    except (ValueError, SymbolDiscoveryError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to discover symbols") from exc


@router.post("/auto-refresh")
def refresh_auto_universe(request: AutoUniverseRefreshRequest):
    try:
        query = SymbolDiscoveryQuery(
            provider=request.provider,
            screens=tuple(request.screens),
            exchanges=tuple(request.exchanges),
            currencies=tuple(request.currencies),
            exchange_mics=tuple(request.exchange_mics),
            quote_types=tuple(request.quote_types),
            limit=request.limit,
            min_market_cap=request.min_market_cap,
            min_volume=request.min_volume,
        )
        auto_request = AutoUniverseRequest(
            universe_id=request.universe_id,
            description=request.description,
            benchmark=request.benchmark,
            discovery=query,
            filters=AutoUniverseFilter(
                currencies=tuple(request.currencies),
                exchange_mics=tuple(request.exchange_mics),
                instrument_types=tuple(request.quote_types),
                min_price=request.min_price,
                max_price=request.max_price,
                min_volume=request.min_volume,
                min_market_cap=request.min_market_cap,
                exclude_symbols=tuple(request.exclude_symbols),
                pinned_symbols=tuple(request.pinned_symbols),
            ),
        )
        return materialize_auto_universe(auto_request, apply=request.apply)
    except (ValueError, SymbolDiscoveryError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to refresh auto universe") from exc


@router.get("/{universe_id}")
async def get_universe(universe_id: str):
    try:
        return get_package_universe_detail(universe_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to load universe detail") from exc


@router.post("/{universe_id}/refresh")
async def refresh_universe(universe_id: str, request: UniverseRefreshRequest):
    try:
        return refresh_package_universe(universe_id, apply=request.apply)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except UniverseSourceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to refresh universe") from exc


@router.post("/{universe_id}/benchmark")
async def update_universe_benchmark(universe_id: str, request: UniverseBenchmarkRequest):
    try:
        return update_package_universe_benchmark(universe_id, request.benchmark)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to update universe benchmark") from exc
