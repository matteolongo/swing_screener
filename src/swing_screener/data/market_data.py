from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional
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
    """
    tks = _normalize_tickers(tickers)
    cache_file = _cache_path(cfg.cache_dir, tks, cfg.start, cfg.end, cfg.auto_adjust)

    if use_cache and (not force_refresh) and cache_file.exists():
        df = pd.read_parquet(cache_file)
        return _clean_ohlcv(df, tks)

    try:
        df = yf.download(
            tks,
            start=cfg.start,
            end=cfg.end,
            auto_adjust=cfg.auto_adjust,
            progress=cfg.progress,
            group_by="column",
            threads=True,
        )
    except Exception as e:
        if allow_cache_fallback_on_error and cache_file.exists():
            df = pd.read_parquet(cache_file)
            return _clean_ohlcv(df, tks)
        raise RuntimeError(f"Download fallito: {e}") from e

    if df is None or df.empty:
        if allow_cache_fallback_on_error and cache_file.exists():
            df = pd.read_parquet(cache_file)
            return _clean_ohlcv(df, tks)
        raise RuntimeError("Download vuoto. Controlla tickers o connessione.")

    # yfinance può tornare:
    # - colonne singole se un ticker
    # - MultiIndex se più ticker
    df = _standardize_columns(df, tks)

    if use_cache:
        df.to_parquet(cache_file)

    return _clean_ohlcv(df, tks)


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
