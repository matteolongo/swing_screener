import dataclasses

from swing_screener.strategy.report_config import ReportConfig
from swing_screener.selection.eval_cache import strategy_signature


def test_signature_is_stable_and_hex():
    cfg = ReportConfig()
    sig = strategy_signature(cfg)
    assert isinstance(sig, str)
    assert sig == strategy_signature(ReportConfig())  # deterministic
    assert all(c in "0123456789abcdef" for c in sig)


def test_signature_ignores_ranking_and_topn():
    base = ReportConfig()
    changed = dataclasses.replace(
        base, ranking=dataclasses.replace(base.ranking, top_n=base.ranking.top_n + 5)
    )
    assert strategy_signature(base) == strategy_signature(changed)


def test_signature_changes_with_signals():
    base = ReportConfig()
    changed = dataclasses.replace(
        base, signals=dataclasses.replace(base.signals, breakout_lookback=base.signals.breakout_lookback + 10)
    )
    assert strategy_signature(base) != strategy_signature(changed)


import pandas as pd
from swing_screener.selection.eval_cache import EvalCache


def _records(tickers):
    return pd.DataFrame(
        {"mom_6m": [1.0] * len(tickers), "is_eligible": [True] * len(tickers)},
        index=pd.Index([t.upper() for t in tickers], name="ticker"),
    )


def test_split_all_miss_when_empty(tmp_path):
    cache = EvalCache(root=tmp_path)
    hits, misses = cache.split(["AAPL", "MSFT"], asof="2026-06-16", sig="abc")
    assert hits.empty
    assert sorted(misses) == ["AAPL", "MSFT"]


def test_write_then_split_hits(tmp_path):
    cache = EvalCache(root=tmp_path)
    cache.write(_records(["AAPL", "MSFT"]), asof="2026-06-16", sig="abc")
    hits, misses = cache.split(["AAPL", "MSFT", "NVDA"], asof="2026-06-16", sig="abc")
    assert sorted(hits.index.tolist()) == ["AAPL", "MSFT"]
    assert misses == ["NVDA"]
    assert hits.loc["AAPL", "mom_6m"] == 1.0


def test_split_isolated_by_asof_and_sig(tmp_path):
    cache = EvalCache(root=tmp_path)
    cache.write(_records(["AAPL"]), asof="2026-06-16", sig="abc")
    _, misses_day = cache.split(["AAPL"], asof="2026-06-17", sig="abc")
    _, misses_sig = cache.split(["AAPL"], asof="2026-06-16", sig="zzz")
    assert misses_day == ["AAPL"]
    assert misses_sig == ["AAPL"]


def test_write_preserves_numeric_dtype(tmp_path):
    """records.loc[[ticker]] preserves column dtypes; iterrows+to_frame().T yields object dtype."""
    records = pd.DataFrame(
        {"mom_6m": [1.5, 2.5], "is_eligible": [True, False], "currency": ["USD", "EUR"]},
        index=pd.Index(["AAPL", "MSFT"], name="ticker"),
    )
    # The fix: slicing with loc[[ticker]] must preserve float64
    for ticker in records.index:
        frame = records.loc[[ticker]]
        assert pd.api.types.is_float_dtype(frame["mom_6m"]), (
            f"loc[[ticker]] yielded {frame['mom_6m'].dtype} for {ticker}; expected float64"
        )
    # End-to-end: write then split must also round-trip correctly
    cache = EvalCache(root=tmp_path)
    cache.write(records, asof="2026-06-16", sig="abc")
    hits, _ = cache.split(["AAPL", "MSFT"], asof="2026-06-16", sig="abc")
    assert pd.api.types.is_float_dtype(hits["mom_6m"]), f"expected float64, got {hits['mom_6m'].dtype}"
    assert hits.loc["AAPL", "mom_6m"] == 1.5
    assert hits.index.name == "ticker"


import os
import time


def test_prune_removes_old_files(tmp_path):
    cache = EvalCache(root=tmp_path)
    cache.write(_records(["AAPL"]), asof="2026-06-16", sig="abc")
    path = cache._path("AAPL", "2026-06-16", "abc")
    old = time.time() - 25 * 3600
    os.utime(path, (old, old))
    cache.write(_records(["MSFT"]), asof="2026-06-16", sig="abc")  # fresh
    cache.prune(max_age_sec=24 * 3600)
    assert not path.exists()
    assert cache._path("MSFT", "2026-06-16", "abc").exists()
