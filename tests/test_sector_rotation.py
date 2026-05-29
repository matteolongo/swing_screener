from __future__ import annotations

import pandas as pd
import pytest


def _make_ohlcv(tickers: list[str], n_bars: int = 130) -> pd.DataFrame:
    import numpy as np

    dates = pd.date_range("2025-10-01", periods=n_bars, freq="B")
    arrays = []
    for field in ("Close", "High", "Low", "Open", "Volume"):
        for ticker in tickers:
            seed = hash(ticker + field) % 100
            base = 100.0 + seed
            data = base + np.cumsum(np.random.default_rng(seed).normal(0, 0.5, n_bars))
            arrays.append(((field, ticker), data))
    cols = pd.MultiIndex.from_tuples([a[0] for a in arrays])
    df = pd.DataFrame({a[0]: a[1] for a in arrays}, index=dates)
    df.columns = cols
    return df


def test_compute_sector_benchmark_returns_returns_dict_for_all_etfs():
    from swing_screener.data.sector_rotation import (
        SECTOR_ETFS,
        compute_sector_benchmark_returns,
    )

    etfs = list(SECTOR_ETFS.keys())
    ohlcv = _make_ohlcv(etfs + ["SPY"])
    result = compute_sector_benchmark_returns(ohlcv)

    for etf in etfs:
        assert etf in result, f"{etf} missing from sector benchmark returns"
        assert isinstance(result[etf], float)


def test_map_sector_to_etf_returns_correct_etf():
    from swing_screener.data.sector_rotation import map_sector_to_etf

    assert map_sector_to_etf("Technology") == "XLK"
    assert map_sector_to_etf("Energy") == "XLE"
    assert map_sector_to_etf("Health Care") == "XLV"
    assert map_sector_to_etf("Financial Services") == "XLF"


def test_map_sector_to_etf_returns_none_for_unknown():
    from swing_screener.data.sector_rotation import map_sector_to_etf

    assert map_sector_to_etf("Unknown Sector") is None
    assert map_sector_to_etf(None) is None


def test_build_ticker_sector_returns_maps_tickers_to_etf_6m_return():
    from swing_screener.data.sector_rotation import SECTOR_ETFS, build_ticker_sector_returns

    ticker_sectors = {"AAPL": "Technology", "JPM": "Financial Services", "XOM": "Energy"}
    etf_returns = {"XLK": 0.08, "XLF": 0.03, "XLE": 0.12}

    result = build_ticker_sector_returns(ticker_sectors, etf_returns)

    assert result["AAPL"] == pytest.approx(0.08)
    assert result["JPM"] == pytest.approx(0.03)
    assert result["XOM"] == pytest.approx(0.12)


def test_build_ticker_sector_returns_none_for_unmapped_sector():
    from swing_screener.data.sector_rotation import build_ticker_sector_returns

    result = build_ticker_sector_returns({"AAPL": "Unknown"}, {"XLK": 0.08})
    assert result.get("AAPL") is None


def test_sector_rotation_scores_dict_has_rotation_flag():
    from swing_screener.data.sector_rotation import (
        SECTOR_ETFS,
        compute_sector_rotation_scores,
    )

    etfs = list(SECTOR_ETFS.keys())
    ohlcv = _make_ohlcv(etfs + ["SPY"])
    result = compute_sector_rotation_scores(ohlcv)

    for etf in etfs:
        assert etf in result
        score = result[etf]
        assert "fast_rs" in score
        assert "slow_rs" in score
        assert "in_rotation" in score
        assert isinstance(score["in_rotation"], bool)
