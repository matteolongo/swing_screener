from __future__ import annotations

import csv
import datetime as dt
import json
import os
from dataclasses import dataclass, field
from typing import Callable, Iterable, Literal
from http.cookiejar import CookieJar
from urllib.parse import quote, urlencode
from urllib.request import HTTPCookieProcessor, Request, build_opener, urlopen

from swing_screener.utils.logging_config import get_logger

logger = get_logger(__name__)


DiscoveryProvider = Literal["yahoo_predefined", "eodhd_exchange"]

YAHOO_SCREENER_URL = "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved"
YAHOO_CUSTOM_SCREENER_URL = "https://query1.finance.yahoo.com/v1/finance/screener"
YAHOO_CRUMB_URL = "https://query1.finance.yahoo.com/v1/test/getcrumb"
YAHOO_COOKIE_URL = "https://fc.yahoo.com"
EODHD_SYMBOL_LIST_URL = "https://eodhd.com/api/exchange-symbol-list/{exchange}"

DEFAULT_YAHOO_SCREENS = ("most_actives", "day_gainers", "day_losers")
YAHOO_EXCHANGE_TO_MIC = {
    "ASE": "XASE",
    "AMS": "XAMS",
    "BRU": "XBRU",
    "BTS": "BATS",
    "FRA": "XFRA",
    "GER": "XETR",
    "HKG": "XHKG",
    "KSC": "XKRX",
    "LSE": "XLON",
    "MCE": "XMAD",
    "MIL": "XMIL",
    "NCM": "XNAS",
    "NGM": "XNAS",
    "NMS": "XNAS",
    "NYQ": "XNYS",
    "PAR": "XPAR",
    "PCX": "ARCX",
    "PNK": "XOTC",
    "SHH": "XSHG",
    "SHZ": "XSHE",
}

YAHOO_MIC_TO_EXCHANGES = {
    "ARCX": ("PCX",),
    "BATS": ("BTS",),
    "XAMS": ("AMS",),
    "XASE": ("ASE",),
    "XBRU": ("BRU",),
    "XETR": ("GER",),
    "XFRA": ("FRA",),
    "XLON": ("LSE",),
    "XMAD": ("MCE",),
    "XMIL": ("MIL",),
    "XNAS": ("NMS", "NCM", "NGM"),
    "XNYS": ("NYQ",),
    "XOTC": ("PNK",),
    "XPAR": ("PAR",),
}
YAHOO_PREDEFINED_MIC_SET = {"ARCX", "BATS", "XASE", "XNAS", "XNYS", "XOTC"}

EODHD_EXCHANGE_TO_MIC = {
    "AMEX": "XASE",
    "AS": "XAMS",
    "BR": "XBRU",
    "CO": "XCSE",
    "F": "XFRA",
    "HK": "XHKG",
    "LSE": "XLON",
    "MI": "XMIL",
    "NASDAQ": "XNAS",
    "NYSE": "XNYS",
    "PA": "XPAR",
    "SW": "XSWX",
    "TO": "XTSE",
    "US": "XNAS",
    "XETRA": "XETR",
}


class SymbolDiscoveryError(RuntimeError):
    pass


@dataclass(frozen=True)
class SymbolDiscoveryQuery:
    provider: DiscoveryProvider = "yahoo_predefined"
    screens: tuple[str, ...] = DEFAULT_YAHOO_SCREENS
    exchanges: tuple[str, ...] = ()
    currencies: tuple[str, ...] = ()
    exchange_mics: tuple[str, ...] = ()
    quote_types: tuple[str, ...] = ("EQUITY",)
    limit: int = 100
    min_market_cap: int | None = None
    min_volume: int | None = None


@dataclass(frozen=True)
class SymbolDiscoveryResult:
    provider: DiscoveryProvider
    source_asof: str
    source_documents: list[dict]
    filters: dict
    symbols: list[dict]
    taxonomy: dict[str, dict[str, int]]
    notes: list[str] = field(default_factory=list)


def _normalize_codes(values: Iterable[str]) -> tuple[str, ...]:
    return tuple(sorted({str(value).strip().upper() for value in values if str(value).strip()}))


def _fetch_json(url: str) -> dict:
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8", errors="ignore"))


def _fetch_yahoo_custom_json(payload: dict) -> dict:
    cookie_jar = CookieJar()
    opener = build_opener(HTTPCookieProcessor(cookie_jar))
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        opener.open(Request(YAHOO_COOKIE_URL, headers=headers), timeout=10).read()
    except Exception:
        logger.debug("Yahoo cookie prefetch failed; continuing without cookie", exc_info=True)
    crumb_request = Request(YAHOO_CRUMB_URL, headers=headers)
    with opener.open(crumb_request, timeout=15) as response:
        crumb = response.read().decode("utf-8", errors="ignore").strip()
    if not crumb:
        raise SymbolDiscoveryError("Yahoo crumb fetch returned empty response; authentication may have changed.")
    request = Request(
        f"{YAHOO_CUSTOM_SCREENER_URL}?{urlencode({'crumb': crumb})}",
        data=json.dumps(payload).encode("utf-8"),
        headers={**headers, "Content-Type": "application/json"},
    )
    with opener.open(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8", errors="ignore"))


def _fetch_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=20) as response:
        return response.read().decode("utf-8", errors="ignore")


def _coerce_int(value: object) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(float(str(value)))
    except (TypeError, ValueError):
        return None


def _normalize_yahoo_market(quote: dict) -> str | None:
    raw_market = str(quote.get("market") or "").strip()
    if raw_market:
        prefix = raw_market.split("_", 1)[0].upper()
        if prefix:
            return prefix
    raw_region = str(quote.get("region") or "").strip().upper()
    return raw_region or None


def _passes_filters(
    item: dict,
    currencies: tuple[str, ...],
    exchange_mics: tuple[str, ...],
    quote_types: tuple[str, ...],
    min_market_cap: int | None,
    min_volume: int | None,
) -> bool:
    if currencies and str(item.get("currency") or "").upper() not in currencies:
        return False
    if exchange_mics and str(item.get("exchange_mic") or "").upper() not in exchange_mics:
        return False
    if quote_types and str(item.get("instrument_type") or "").upper() not in quote_types:
        return False
    if min_market_cap is not None and (item.get("market_cap") or 0) < min_market_cap:
        return False
    if min_volume is not None and (item.get("volume") or 0) < min_volume:
        return False
    return True


def _taxonomy(symbols: list[dict]) -> dict[str, dict[str, int]]:
    buckets = {"currency": {}, "exchange_mic": {}, "market": {}, "instrument_type": {}}
    for item in symbols:
        for key in buckets:
            value = str(item.get(key) or "UNKNOWN").upper()
            buckets[key][value] = buckets[key].get(value, 0) + 1
    return {key: dict(sorted(values.items())) for key, values in buckets.items()}


def _yahoo_symbol_from_quote(quote: dict, *, screen: str, rank: int) -> dict:
    exchange_code = str(quote.get("exchange") or "").upper()
    quote_type = str(quote.get("quoteType") or "UNKNOWN").upper()
    return {
        "symbol": str(quote.get("symbol") or "").upper(),
        "name": quote.get("shortName") or quote.get("longName") or quote.get("displayName"),
        "instrument_type": quote_type,
        "currency": str(quote.get("currency") or "").upper() or None,
        "market": _normalize_yahoo_market(quote),
        "exchange_mic": YAHOO_EXCHANGE_TO_MIC.get(exchange_code),
        "provider_exchange": exchange_code or None,
        "exchange_name": quote.get("fullExchangeName"),
        "market_cap": _coerce_int(quote.get("marketCap") or quote.get("intradaymarketcap")),
        "volume": _coerce_int(quote.get("regularMarketVolume") or quote.get("averageDailyVolume3Month")),
        "last_price": quote.get("regularMarketPrice"),
        "sector": quote.get("sector"),
        "industry": quote.get("industry"),
        "source": "yahoo_predefined",
        "source_screen": screen,
        "discovery_rank": rank,
    }


def _yahoo_custom_payload(*, query_field: str, query_value: str, query: SymbolDiscoveryQuery) -> dict:
    quote_types = _normalize_codes(query.quote_types)
    return {
        "offset": 0,
        "size": max(query.limit, 1),
        "sortField": "intradaymarketcap",
        "sortType": "DESC",
        "quoteType": quote_types[0] if len(quote_types) == 1 else "EQUITY",
        "query": {
            "operator": "and",
            "operands": [
                {
                    "operator": "eq",
                    "operands": [query_field, query_value],
                }
            ],
        },
        "userId": "",
        "userIdType": "guid",
    }


def _yahoo_custom_queries(query: SymbolDiscoveryQuery) -> list[tuple[str, str]]:
    exchange_mics = _normalize_codes(query.exchange_mics)
    out: list[tuple[str, str]] = []
    for mic in exchange_mics:
        if mic in YAHOO_PREDEFINED_MIC_SET:
            continue
        for exchange in YAHOO_MIC_TO_EXCHANGES.get(mic, ()):
            out.append(("exchange", exchange))
    if out:
        return out

    currencies = _normalize_codes(query.currencies)
    return [("currency", currency) for currency in currencies if currency != "USD"]


def _discover_with_yahoo_custom_screener(
    query: SymbolDiscoveryQuery,
    *,
    fetch_custom_json: Callable[[dict], dict] = _fetch_yahoo_custom_json,
) -> list[dict]:
    seen: set[str] = set()
    symbols: list[dict] = []
    currencies = _normalize_codes(query.currencies)
    exchange_mics = _normalize_codes(query.exchange_mics)
    quote_types = _normalize_codes(query.quote_types)
    for query_field, value in _yahoo_custom_queries(query):
        data = fetch_custom_json(_yahoo_custom_payload(query_field=query_field, query_value=value, query=query))
        result = ((data.get("finance") or {}).get("result") or [{}])[0]
        for index, quote in enumerate(result.get("quotes") or [], start=1):
            item = _yahoo_symbol_from_quote(quote, screen=f"custom_{query_field}_{value}", rank=index)
            symbol = item.get("symbol")
            if not symbol or symbol in seen:
                continue
            if not _passes_filters(item, currencies, exchange_mics, quote_types, query.min_market_cap, query.min_volume):
                continue
            seen.add(symbol)
            symbols.append(item)
            if len(symbols) >= query.limit:
                return symbols
    return symbols


def discover_with_yahoo_predefined(
    query: SymbolDiscoveryQuery,
    *,
    fetch_json: Callable[[str], dict] = _fetch_json,
    fetch_custom_json: Callable[[dict], dict] = _fetch_yahoo_custom_json,
) -> SymbolDiscoveryResult:
    screens = query.screens
    seen: set[str] = set()
    symbols: list[dict] = []
    notes: list[str] = [
        "Yahoo Finance screeners are free but unofficial; use results as candidates, not as an exchange master.",
    ]
    custom_queries = _yahoo_custom_queries(query)

    if custom_queries:
        try:
            symbols = _discover_with_yahoo_custom_screener(query, fetch_custom_json=fetch_custom_json)
            notes.append("Used Yahoo custom screener because exchange/currency filters require non-US enumeration.")
        except Exception as exc:  # pragma: no cover - live Yahoo auth can vary by environment
            notes.append(f"Yahoo custom screener failed ({type(exc).__name__}); falling back to predefined screeners.")

    if not symbols:
        currencies = _normalize_codes(query.currencies)
        exchange_mics = _normalize_codes(query.exchange_mics)
        quote_types = _normalize_codes(query.quote_types)
        for screen in screens:
            url = f"{YAHOO_SCREENER_URL}?{urlencode({'scrIds': screen, 'count': query.limit})}"
            data = fetch_json(url)
            result = ((data.get("finance") or {}).get("result") or [{}])[0]
            for index, quote in enumerate(result.get("quotes") or [], start=1):
                item = _yahoo_symbol_from_quote(quote, screen=screen, rank=index)
                symbol = item.get("symbol")
                if not symbol or symbol in seen:
                    continue
                if not _passes_filters(item, currencies, exchange_mics, quote_types, query.min_market_cap, query.min_volume):
                    continue
                seen.add(symbol)
                symbols.append(item)
                if len(symbols) >= query.limit:
                    break
            if len(symbols) >= query.limit:
                break
    else:
        currencies = _normalize_codes(query.currencies)
        exchange_mics = _normalize_codes(query.exchange_mics)

    us_mics = {"ARCX", "BATS", "XASE", "XNAS", "XNYS", "XOTC"}
    requested_currencies = currencies
    requested_mics = exchange_mics
    if not symbols and (
        any(currency != "USD" for currency in requested_currencies)
        or any(mic not in us_mics for mic in requested_mics)
    ):
        notes.append(
            "Yahoo predefined screeners are US-centric; Yahoo custom screener is required for many EUR exchange lists.",
        )

    return SymbolDiscoveryResult(
        provider="yahoo_predefined",
        source_asof=dt.date.today().isoformat(),
        source_documents=[{"label": "Yahoo Finance predefined screener endpoint", "url": YAHOO_SCREENER_URL}],
        filters=_query_filters(query),
        symbols=symbols,
        taxonomy=_taxonomy(symbols),
        notes=notes,
    )


def _eodhd_symbol_from_row(row: dict, exchange: str) -> dict:
    code = str(row.get("Code") or row.get("code") or row.get("symbol") or "").upper()
    type_value = str(row.get("Type") or row.get("type") or "UNKNOWN").upper()
    return {
        "symbol": code,
        "name": row.get("Name") or row.get("name"),
        "instrument_type": "ETF" if type_value == "ETF" else "EQUITY" if "COMMON" in type_value or type_value in {"STOCK", "EQUITY"} else type_value,
        "currency": str(row.get("Currency") or row.get("currency") or "").upper() or None,
        "market": str(row.get("Country") or row.get("country") or exchange).upper() or None,
        "exchange_mic": EODHD_EXCHANGE_TO_MIC.get(exchange.upper()),
        "provider_exchange": exchange.upper(),
        "exchange_name": row.get("Exchange") or row.get("exchange"),
        "isin": row.get("Isin") or row.get("ISIN") or row.get("isin"),
        "source": "eodhd_exchange",
    }


def discover_with_eodhd_exchange(
    query: SymbolDiscoveryQuery,
    *,
    api_token: str | None = None,
    fetch_text: Callable[[str], str] = _fetch_text,
) -> SymbolDiscoveryResult:
    token = api_token or os.getenv("EODHD_API_KEY") or os.getenv("EOD_HISTORICAL_DATA_API_KEY")
    if not token:
        raise SymbolDiscoveryError("EODHD discovery requires EODHD_API_KEY or EOD_HISTORICAL_DATA_API_KEY.")
    if not query.exchanges:
        raise SymbolDiscoveryError("EODHD discovery requires at least one exchange code, e.g. NASDAQ, NYSE, PA, AS.")

    symbols: list[dict] = []
    seen: set[str] = set()
    documents: list[dict] = []
    currencies = _normalize_codes(query.currencies)
    exchange_mics = _normalize_codes(query.exchange_mics)
    quote_types = _normalize_codes(query.quote_types)
    for exchange in query.exchanges:
        safe_exchange = quote(exchange, safe="")
        url = f"{EODHD_SYMBOL_LIST_URL.format(exchange=safe_exchange)}?{urlencode({'api_token': token, 'fmt': 'csv'})}"
        documents.append({"label": f"EODHD exchange symbol list: {exchange.upper()}", "url": EODHD_SYMBOL_LIST_URL.format(exchange=safe_exchange)})
        reader = csv.DictReader(fetch_text(url).splitlines())
        for row in reader:
            item = _eodhd_symbol_from_row(row, exchange)
            symbol = item.get("symbol")
            if not symbol or symbol in seen:
                continue
            if not _passes_filters(item, currencies, exchange_mics, quote_types, query.min_market_cap, query.min_volume):
                continue
            seen.add(symbol)
            symbols.append(item)
            if len(symbols) >= query.limit:
                break
        if len(symbols) >= query.limit:
            break

    return SymbolDiscoveryResult(
        provider="eodhd_exchange",
        source_asof=dt.date.today().isoformat(),
        source_documents=documents,
        filters=_query_filters(query),
        symbols=symbols,
        taxonomy=_taxonomy(symbols),
        notes=[
            "EODHD has a free tier but requires an API key and has tight daily call limits; cache promoted results before screening large lists.",
        ],
    )


def _query_filters(query: SymbolDiscoveryQuery) -> dict:
    return {
        "screens": list(query.screens),
        "exchanges": list(query.exchanges),
        "currencies": list(query.currencies),
        "exchange_mics": list(query.exchange_mics),
        "quote_types": list(query.quote_types),
        "limit": query.limit,
        "min_market_cap": query.min_market_cap,
        "min_volume": query.min_volume,
    }


def discover_symbols(
    query: SymbolDiscoveryQuery,
    *,
    fetch_json: Callable[[str], dict] = _fetch_json,
    fetch_yahoo_custom_json: Callable[[dict], dict] = _fetch_yahoo_custom_json,
    fetch_text: Callable[[str], str] = _fetch_text,
    eodhd_api_token: str | None = None,
) -> SymbolDiscoveryResult:
    if query.limit <= 0:
        raise ValueError("limit must be positive.")
    if query.provider == "yahoo_predefined" and not query.screens:
        raise ValueError("screens must be non-empty for yahoo_predefined.")
    if query.provider == "yahoo_predefined":
        return discover_with_yahoo_predefined(
            query,
            fetch_json=fetch_json,
            fetch_custom_json=fetch_yahoo_custom_json,
        )
    if query.provider == "eodhd_exchange":
        return discover_with_eodhd_exchange(query, api_token=eodhd_api_token, fetch_text=fetch_text)
    raise ValueError(f"Unsupported discovery provider: {query.provider}")
