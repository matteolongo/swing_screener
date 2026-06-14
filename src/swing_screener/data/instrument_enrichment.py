from __future__ import annotations

import datetime as dt
from typing import Callable, Optional

from swing_screener.data.symbol_discovery import YAHOO_EXCHANGE_TO_MIC

# MIC -> (country_code, timezone)
MIC_TO_COUNTRY_TZ: dict[str, tuple[str, str]] = {
    "XNAS": ("US", "America/New_York"),
    "XNYS": ("US", "America/New_York"),
    "XASE": ("US", "America/New_York"),
    "ARCX": ("US", "America/New_York"),
    "BATS": ("US", "America/New_York"),
    "XOTC": ("US", "America/New_York"),
    "XETR": ("DE", "Europe/Berlin"),
    "XFRA": ("DE", "Europe/Berlin"),
    "XPAR": ("FR", "Europe/Paris"),
    "XLON": ("GB", "Europe/London"),
    "XMAD": ("ES", "Europe/Madrid"),
    "XMIL": ("IT", "Europe/Rome"),
    "XAMS": ("NL", "Europe/Amsterdam"),
    "XBRU": ("BE", "Europe/Brussels"),
    "XDUB": ("IE", "Europe/Dublin"),
    "XHEL": ("FI", "Europe/Helsinki"),
    "XSWX": ("CH", "Europe/Zurich"),
}

# Yahoo exchange codes seen on EuroStoxx venues not already in symbol_discovery's map.
_EXTRA_EXCHANGE_TO_MIC = {
    "EBS": "XSWX",
    "VIE": "XWBO",
    "HEL": "XHEL",
    "ISE": "XDUB",
    "DUB": "XDUB",
}

InfoProvider = Callable[[str], dict]


def _default_info_provider(symbol: str) -> dict:
    import yfinance as yf  # imported lazily; network at build time only

    try:
        return dict(yf.Ticker(symbol).info or {})
    except Exception:
        return {}


def _resolve_mic(exchange_code: str, full_exchange: str) -> Optional[str]:
    code = str(exchange_code or "").strip().upper()
    if code in YAHOO_EXCHANGE_TO_MIC:
        return YAHOO_EXCHANGE_TO_MIC[code]
    if code in _EXTRA_EXCHANGE_TO_MIC:
        return _EXTRA_EXCHANGE_TO_MIC[code]
    full = str(full_exchange or "").strip().upper()
    if "XETRA" in full:
        return "XETR"
    return None


def _map_type(quote_type: str) -> str:
    qt = str(quote_type or "").strip().upper()
    if qt == "EQUITY":
        return "equity"
    if qt == "ETF":
        return "etf"
    return qt.lower() or "unknown"


def enrich_symbol(
    symbol: str,
    *,
    info_provider: InfoProvider = _default_info_provider,
) -> Optional[dict]:
    """Build an instrument-master record from yfinance .info. None if unresolved."""
    sym = str(symbol or "").strip().upper()
    if not sym:
        return None
    info = info_provider(sym) or {}
    mic = _resolve_mic(info.get("exchange", ""), info.get("fullExchangeName", ""))
    currency = str(info.get("currency") or "").strip().upper()
    if not mic or not currency or mic not in MIC_TO_COUNTRY_TZ:
        return None
    country, timezone = MIC_TO_COUNTRY_TZ[mic]
    today = dt.date.today().isoformat()
    return {
        "symbol": sym,
        "exchange_mic": mic,
        "country_code": country,
        "currency": currency,
        "timezone": timezone,
        "provider_symbol_map": {"yahoo_finance": sym},
        "primary_listing": True,
        "status": "active",
        "status_reason": None,
        "replacement_symbol": None,
        "source": "wikipedia_yfinance",
        "source_asof": today,
        "last_reviewed_at": today,
        "instrument_type": _map_type(info.get("quoteType", "")),
    }
