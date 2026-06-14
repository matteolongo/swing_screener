from __future__ import annotations

import io
import re
from dataclasses import dataclass
from typing import Callable
from urllib.error import URLError
from urllib.request import Request, urlopen

import pandas as pd

WIKIPEDIA_BASE = "https://en.wikipedia.org/wiki/"


def _fetch_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urlopen(request, timeout=30) as response:
            raw = response.read()
    except URLError as exc:  # pragma: no cover - network failures depend on env
        raise _error(f"Failed to fetch source document: {url}") from exc
    return raw.decode("utf-8", errors="ignore")


@dataclass(frozen=True)
class IndexPageConfig:
    universe_id: str
    benchmark: str
    wiki_slug: str
    ticker_col: str
    company_col: str
    default_suffix: str


WIKIPEDIA_INDEX_CONFIG: dict[str, IndexPageConfig] = {
    "us_sp500": IndexPageConfig(
        "us_sp500", "^GSPC", "List_of_S%26P_500_companies", "symbol", "security", ""
    ),
    "us_nasdaq100": IndexPageConfig(
        "us_nasdaq100", "^NDX", "Nasdaq-100", "ticker", "company", ""
    ),
    "us_dow30": IndexPageConfig(
        "us_dow30", "^DJI", "Dow_Jones_Industrial_Average", "symbol", "company", ""
    ),
    "germany_dax": IndexPageConfig(
        "germany_dax", "^GDAXI", "DAX", "ticker", "company", ".DE"
    ),
    "france_cac40": IndexPageConfig(
        "france_cac40", "^FCHI", "CAC_40", "ticker", "company", ".PA"
    ),
    "uk_ftse100": IndexPageConfig(
        "uk_ftse100", "^FTSE", "FTSE_100_Index", "ticker", "company", ".L"
    ),
    "spain_ibex35": IndexPageConfig(
        "spain_ibex35", "^IBEX", "IBEX_35", "ticker", "company", ".MC"
    ),
    "europe_eurostoxx50": IndexPageConfig(
        "europe_eurostoxx50", "^STOXX50E", "EURO_STOXX_50", "ticker", "name", ""
    ),
}

_EUROSTOXX_VENUE_SUFFIX = {
    "ETR": ".DE",
    "FRA": ".DE",
    "XETRA": ".DE",
    "ENXTPA": ".PA",
    "EPA": ".PA",
    "PAR": ".PA",
    "ENXTAM": ".AS",
    "AMS": ".AS",
    "BIT": ".MI",
    "MIL": ".MI",
    "BME": ".MC",
    "MCE": ".MC",
    "ENXTBR": ".BR",
    "BRU": ".BR",
    "ISE": ".IR",
    "HEL": ".HE",
}


@dataclass(frozen=True)
class RawConstituent:
    symbol: str
    source_name: str
    source_symbol: str


def _error(msg: str) -> Exception:
    # Lazy import avoids a module-level cycle with universe_sources.
    from swing_screener.data.universe_sources import UniverseSourceError

    return UniverseSourceError(msg)


def _flat_columns(table: pd.DataFrame) -> list[str]:
    if isinstance(table.columns, pd.MultiIndex):
        return [" ".join(str(x) for x in tup) for tup in table.columns]
    return [str(c) for c in table.columns]


def _flatten(table: pd.DataFrame) -> pd.DataFrame:
    table = table.copy()
    table.columns = _flat_columns(table)
    return table


def _select_table(html: str, ticker_col: str, company_col: str) -> pd.DataFrame:
    try:
        tables = pd.read_html(io.StringIO(html))
    except ImportError as exc:
        raise _error(
            "pandas.read_html needs an HTML parser; install 'lxml' "
            f"(import failed: {exc})"
        ) from exc
    except ValueError as exc:
        raise _error(
            f"No constituent table with columns ~'{ticker_col}'/'{company_col}' found"
        ) from exc
    for table in tables:
        cols = [str(c).lower() for c in _flat_columns(table)]
        has_ticker = any(ticker_col in c for c in cols)
        has_company = any(company_col in c for c in cols)
        if has_ticker and has_company:
            return _flatten(table)
    raise _error(
        f"No constituent table with columns ~'{ticker_col}'/'{company_col}' found"
    )


def _pick_col(df: pd.DataFrame, needle: str) -> str:
    for col in df.columns:
        if needle in str(col).lower():
            return col
    raise _error(f"Column matching '{needle}' vanished after selection")


def normalize_yahoo_symbol(raw: str, default_suffix: str) -> str:
    text = str(raw or "").strip()
    if ":" in text:
        text = text.split(":", 1)[1].strip()
    text = re.sub(r"\s+", "", text).upper()
    text = text.strip(".")
    if not text:
        return ""
    if "." in text and text.rsplit(".", 1)[1] in {
        "DE",
        "PA",
        "L",
        "MC",
        "MI",
        "AS",
        "BR",
        "IR",
        "HE",
        "SW",
    }:
        return text
    if default_suffix in ("", None):
        return text.replace(".", "-")
    body = text.replace(".", "-") if default_suffix == ".L" else text
    return f"{body}{default_suffix}"


def _eurostoxx_symbol(ticker_cell: str) -> str:
    text = str(ticker_cell or "").strip()
    prefix = text.split(":", 1)[0].strip().upper() if ":" in text else ""
    suffix = _EUROSTOXX_VENUE_SUFFIX.get(prefix, "")
    return normalize_yahoo_symbol(text, suffix)


def fetch_index_constituents(
    universe_id: str,
    *,
    fetch_text: Callable[[str], str] = _fetch_text,
) -> list[RawConstituent]:
    cfg = WIKIPEDIA_INDEX_CONFIG.get(universe_id)
    if cfg is None:
        raise _error(f"No Wikipedia config for universe '{universe_id}'")
    html = fetch_text(WIKIPEDIA_BASE + cfg.wiki_slug)
    df = _select_table(html, cfg.ticker_col, cfg.company_col)
    tcol = _pick_col(df, cfg.ticker_col)
    ccol = _pick_col(df, cfg.company_col)

    out: list[RawConstituent] = []
    seen: set[str] = set()
    for _, row in df.iterrows():
        raw_ticker = str(row[tcol])
        name = str(row[ccol]).strip()
        if universe_id == "europe_eurostoxx50":
            symbol = _eurostoxx_symbol(raw_ticker)
        else:
            symbol = normalize_yahoo_symbol(raw_ticker, cfg.default_suffix)
        if not symbol or symbol in seen or symbol.lower() in {"nan", "—"}:
            continue
        seen.add(symbol)
        bare = symbol.rsplit(".", 1)[0] if "." in symbol else symbol
        out.append(RawConstituent(symbol=symbol, source_name=name, source_symbol=bare))
    if not out:
        raise _error(f"Parsed zero constituents for '{universe_id}'")
    return out
