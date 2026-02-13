from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional
import datetime as dt
import hashlib
import json

import pandas as pd
import yfinance as yf


@dataclass(frozen=True)
class MarketDataConfig:
    start: str = "2022-01-01"
    end: Optional[str] = None
    auto_adjust: bool = True
    progress: bool = False
    cache_dir: str = ".cache/market_data"


def _normalize_tickers(tickers: Iterable[str]) -> list[str]:
    out = []
    for t in tickers:
        t = t.strip().upper()
        if t and t not in out:
            out.append(t)
    if not out:
        raise ValueError("tickers è vuoto.")
    return out


def _cache_path(
    cache_dir: str,
    tickers: list[str],
    start: str,
    end: Optional[str],
    auto_adjust: bool,
) -> Path:
    safe_end = end if end else "NONE"
    key = f"{'-'.join(tickers)}__{start}__{safe_end}__adj={int(auto_adjust)}"
    key = key.replace("/", "_")
    if len(key) > 200:
        digest = hashlib.sha1(key.encode("utf-8")).hexdigest()
        prefix = "-".join(tickers[:3])
        key = f"{prefix}__n={len(tickers)}__{start}__{safe_end}__adj={int(auto_adjust)}__{digest}"
    p = Path(cache_dir)
    p.mkdir(parents=True, exist_ok=True)
    return p / f"{key}.parquet"


def fetch_ohlcv(
    tickers: Iterable[str],
    cfg: MarketDataConfig = MarketDataConfig(),
    use_cache: bool = True,
    force_refresh: bool = False,
    allow_cache_fallback_on_error: bool = True,
) -> pd.DataFrame:
    """
    Scarica OHLCV da Yahoo Finance (via yfinance), opzionalmente con cache su parquet.
    Se il download fallisce e la cache esiste, può fare fallback al parquet locale.

    Output: DataFrame con colonne MultiIndex: (field, ticker)
      field ∈ {Open, High, Low, Close, Volume}
      
    Note:
        This function is a wrapper around YfinanceProvider for backward compatibility.
        New code should use get_market_data_provider() and call fetch_ohlcv on the provider.
    """
    from swing_screener.data.providers.yfinance_provider import YfinanceProvider
    
    # Create provider with the same configuration
    provider = YfinanceProvider(
        cache_dir=cfg.cache_dir,
        auto_adjust=cfg.auto_adjust,
        progress=cfg.progress,
    )
    
    # Determine end date - keep None to preserve cache path behavior
    end_date = cfg.end
    if end_date is None:
        # Use "today" as a sentinel that gets converted in provider
        # but for cache purposes we want None behavior preserved
        # Let's use a special fetch method that handles None
        return provider._fetch_ohlcv_with_config(
            list(tickers),
            start_date=cfg.start,
            end_date=None,
            use_cache=use_cache,
            force_refresh=force_refresh,
            allow_cache_fallback_on_error=allow_cache_fallback_on_error,
        )
    
    # Call provider's fetch_ohlcv with explicit end date
    return provider.fetch_ohlcv(
        list(tickers),
        start_date=cfg.start,
        end_date=end_date,
        use_cache=use_cache,
        force_refresh=force_refresh,
        allow_cache_fallback_on_error=allow_cache_fallback_on_error,
    )


def _standardize_columns(df: pd.DataFrame, tickers: list[str]) -> pd.DataFrame:
    if not isinstance(df.columns, pd.MultiIndex):
        t = tickers[0]
        df.columns = pd.MultiIndex.from_product([df.columns, [t]])
        return df

    fields = {"Open", "High", "Low", "Close", "Adj Close", "Volume"}

    lvl0 = set(map(str, df.columns.get_level_values(0).unique()))
    lvl1 = set(map(str, df.columns.get_level_values(1).unique()))

    if lvl0.issubset(fields):
        # (field, ticker)
        return df

    if lvl1.issubset(fields):
        # (ticker, field) -> swap to (field, ticker)
        df.columns = df.columns.swaplevel(0, 1)
        return df.sort_index(axis=1)

    # fallback: try to infer by checking intersection sizes
    if len(lvl0 & fields) > len(lvl1 & fields):
        return df
    if len(lvl1 & fields) > len(lvl0 & fields):
        df.columns = df.columns.swaplevel(0, 1)
        return df.sort_index(axis=1)

    raise ValueError(
        "Impossibile inferire l'ordine dei livelli MultiIndex (field,ticker) vs (ticker,field)."
    )


def _clean_ohlcv(df: pd.DataFrame, tickers: list[str]) -> pd.DataFrame:
    """
    - Tiene solo Open/High/Low/Close/Volume
    - Rimuove righe completamente NaN
    - Ordina index per data
    - Garantisce che ogni ticker abbia le colonne presenti (se mancano, le crea NaN)
    """
    df = df.copy()
    df = df.sort_index()
    df = df.loc[~df.index.duplicated(keep="last")]

    # Se auto_adjust=False, può esistere "Adj Close"; noi teniamo sempre "Close"
    keep_fields = ["Open", "High", "Low", "Close", "Volume"]
    existing_fields = [f for f in keep_fields if f in df.columns.get_level_values(0)]
    df = df.loc[:, df.columns.get_level_values(0).isin(existing_fields)]

    # assicura colonne per ticker mancanti
    cols = []
    for f in existing_fields:
        for t in tickers:
            cols.append((f, t))
    df = df.reindex(columns=pd.MultiIndex.from_tuples(cols))

    # drop righe tutte NaN
    df = df.dropna(how="all")
    return df


def fetch_ticker_metadata(
    tickers: Iterable[str],
    cache_path: str = ".cache/ticker_meta.json",
    use_cache: bool = True,
    force_refresh: bool = False,
) -> pd.DataFrame:
    """
    Fetch lightweight metadata for tickers (name, currency, exchange) via yfinance.
    Uses a small JSON cache to avoid repeated network calls.
    """
    tks = _normalize_tickers(tickers)
    cache_file = Path(cache_path)
    cache: dict[str, dict] = {}
    if use_cache and cache_file.exists():
        try:
            cache = json.loads(cache_file.read_text(encoding="utf-8"))
        except Exception:
            cache = {}

    results: dict[str, dict] = {}
    for t in tks:
        if (not force_refresh) and t in cache:
            results[t] = cache[t]
            continue

        name = None
        currency = None
        exchange = None

        tk = None
        try:
            tk = yf.Ticker(t)
            fi = getattr(tk, "fast_info", None)
            if fi:
                currency = getattr(fi, "currency", None) or fi.get("currency", None)
                exchange = getattr(fi, "exchange", None) or fi.get("exchange", None)
        except Exception:
            tk = None

        if tk and (name is None or currency is None or exchange is None):
            try:
                info = tk.get_info()
                name = info.get("shortName") or info.get("longName") or name
                currency = currency or info.get("currency")
                exchange = exchange or info.get("exchange") or info.get("fullExchangeName")
            except Exception:
                info = None

        results[t] = {
            "name": name,
            "currency": currency,
            "exchange": exchange,
        }

    if use_cache:
        cache.update(results)
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(json.dumps(cache, indent=2), encoding="utf-8")

    df = pd.DataFrame.from_dict(results, orient="index")
    df.index.name = "ticker"
    return df
