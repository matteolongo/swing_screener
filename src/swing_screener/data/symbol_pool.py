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


DEFAULT_CAP_THRESHOLDS = {"large": 10_000_000_000, "mid": 2_000_000_000, "small": 300_000_000}
DEFAULT_LIQUIDITY_THRESHOLDS = {"high": 50_000_000, "mid": 5_000_000}

PROVIDER_KEY_MAP = {
    "yahoo_finance": "yfinance",
    "yfinance": "yfinance",
    "degiro": "degiro",
    "eodhd": "eodhd",
    "polygon": "polygon",
}
PROVIDER_PREFERENCE = ("yfinance", "polygon", "eodhd", "degiro")

US_MICS = {"XNAS", "XNYS", "ARCX", "BATS", "XASE", "XOTC"}
EUROPE_MICS = {
    "XAMS",
    "XETR",
    "XPAR",
    "XMAD",
    "XMIL",
    "XLON",
    "XBRU",
    "XLIS",
    "XHEL",
    "XSTO",
    "XCSE",
    "XOSL",
    "XSWX",
    "XWBO",
    "XDUB",
}
ASIA_PACIFIC_MICS = {
    "XSHE",
    "XSHG",
    "XHKG",
    "XTKS",
    "XKRX",
    "XASX",
    "XTAI",
    "XBOM",
    "XNSE",
    "XSES",
}

_US_COUNTRIES = {"US", "USA"}
_EUROPE_COUNTRIES = {
    "NL",
    "DE",
    "FR",
    "ES",
    "IT",
    "GB",
    "UK",
    "BE",
    "PT",
    "FI",
    "SE",
    "DK",
    "NO",
    "CH",
    "AT",
    "IE",
}
_ASIA_PACIFIC_COUNTRIES = {"CN", "HK", "JP", "KR", "AU", "TW", "IN", "SG"}


def derive_region(exchange_mic: str | None, country_code: str | None) -> str:
    mic = (exchange_mic or "").upper()
    if mic in US_MICS:
        return "us"
    if mic in EUROPE_MICS:
        return "europe"
    if mic in ASIA_PACIFIC_MICS:
        return "asia_pacific"
    cc = (country_code or "").upper()
    if cc in _US_COUNTRIES:
        return "us"
    if cc in _EUROPE_COUNTRIES:
        return "europe"
    if cc in _ASIA_PACIFIC_COUNTRIES:
        return "asia_pacific"
    return "other"


def derive_cap_tier(market_cap: float | None, thresholds: dict | None = None) -> str | None:
    if market_cap is None:
        return None
    t = thresholds or DEFAULT_CAP_THRESHOLDS
    if market_cap >= t["large"]:
        return "large"
    if market_cap >= t["mid"]:
        return "mid"
    if market_cap >= t["small"]:
        return "small"
    return "micro"


def derive_liquidity_tier(
    avg_dollar_volume: float | None, thresholds: dict | None = None
) -> str | None:
    if avg_dollar_volume is None:
        return None
    t = thresholds or DEFAULT_LIQUIDITY_THRESHOLDS
    if avg_dollar_volume >= t["high"]:
        return "high"
    if avg_dollar_volume >= t["mid"]:
        return "mid"
    return "low"


def derive_instrument_detail(
    quote_type: str | None, category: str | None, instrument_type: str | None
) -> str | None:
    qt = (quote_type or "").upper()
    itype = (instrument_type or "").lower()
    is_etf = qt == "ETF" or itype == "etf"
    if not is_etf:
        if qt in {"EQUITY", "STOCK"} or itype == "equity":
            return "equity"
        return instrument_type or None
    cat = (category or "").lower()
    if "leverag" in cat or "inverse" in cat or "ultra" in cat:
        return "etf_leveraged"
    if "bond" in cat or "fixed income" in cat or "treasury" in cat:
        return "etf_bond"
    if "commodit" in cat or "gold" in cat or "silver" in cat or "oil" in cat:
        return "etf_commodity"
    _SECTOR_WORDS = (
        "technology",
        "financial",
        "energy",
        "health",
        "industrial",
        "utilities",
        "materials",
        "consumer",
        "real estate",
        "communication",
    )
    if any(w in cat for w in _SECTOR_WORDS):
        return "etf_sector"
    return "etf_equity"


def derive_providers(provider_symbol_map: dict | None) -> tuple[list[str], str | None]:
    if not provider_symbol_map:
        return (["yfinance"], "yfinance")
    available: list[str] = []
    for raw_key in provider_symbol_map:
        mapped = PROVIDER_KEY_MAP.get(str(raw_key).lower())
        if mapped and mapped not in available:
            available.append(mapped)
    if not available:
        return (["yfinance"], "yfinance")
    primary = next((p for p in PROVIDER_PREFERENCE if p in available), available[0])
    return (available, primary)
