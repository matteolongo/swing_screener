"""Unified taxonomy-filtered symbol pool: schema, build, and filtering.

The pool (`data/symbol_pool.json`) is the query-time source of truth for the
screener. It is built by merging the universe registry snapshots with the
instrument master (network-free) plus best-effort yfinance enrichment.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

POOL_SCHEMA_VERSION = 1

REGION_VALUES = ("us", "europe", "asia_pacific", "other")
CAP_TIER_VALUES = ("large", "mid", "small", "micro")
LIQUIDITY_TIER_VALUES = ("high", "mid", "low")
INSTRUMENT_DETAIL_VALUES = (
    "equity",
    "etf_equity",
    "etf_sector",
    "etf_leveraged",
    "etf_bond",
    "etf_commodity",
)


@dataclass
class PoolSymbol:
    symbol: str
    exchange_mic: str | None = None
    currency: str | None = None
    region: str | None = None
    market_cap_tier: str | None = None
    sector: str | None = None
    industry: str | None = None
    index_memberships: list[str] = field(default_factory=list)
    liquidity_tier: str | None = None
    instrument_type: str | None = None
    instrument_type_detail: str | None = None
    available_providers: list[str] = field(default_factory=list)
    primary_provider: str | None = None
    taxonomy_refreshed_at: str | None = None
    fetch_failure_count: int = 0
    last_fetch_ok_at: str | None = None


def pool_symbol_to_dict(sym: PoolSymbol) -> dict:
    return {
        "symbol": sym.symbol,
        "exchange_mic": sym.exchange_mic,
        "currency": sym.currency,
        "region": sym.region,
        "market_cap_tier": sym.market_cap_tier,
        "sector": sym.sector,
        "industry": sym.industry,
        "index_memberships": list(sym.index_memberships),
        "liquidity_tier": sym.liquidity_tier,
        "instrument_type": sym.instrument_type,
        "instrument_type_detail": sym.instrument_type_detail,
        "available_providers": list(sym.available_providers),
        "primary_provider": sym.primary_provider,
        "taxonomy_refreshed_at": sym.taxonomy_refreshed_at,
        "fetch_failure_count": int(sym.fetch_failure_count or 0),
        "last_fetch_ok_at": sym.last_fetch_ok_at,
    }


def pool_symbol_from_dict(d: dict) -> PoolSymbol:
    return PoolSymbol(
        symbol=str(d["symbol"]).strip().upper(),
        exchange_mic=d.get("exchange_mic"),
        currency=d.get("currency"),
        region=d.get("region"),
        market_cap_tier=d.get("market_cap_tier"),
        sector=d.get("sector"),
        industry=d.get("industry"),
        index_memberships=list(d.get("index_memberships") or []),
        liquidity_tier=d.get("liquidity_tier"),
        instrument_type=d.get("instrument_type"),
        instrument_type_detail=d.get("instrument_type_detail"),
        available_providers=list(d.get("available_providers") or []),
        primary_provider=d.get("primary_provider"),
        taxonomy_refreshed_at=d.get("taxonomy_refreshed_at"),
        fetch_failure_count=int(d.get("fetch_failure_count") or 0),
        last_fetch_ok_at=d.get("last_fetch_ok_at"),
    )
