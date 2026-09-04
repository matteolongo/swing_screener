import dataclasses
import os
import time

import pandas as pd

import swing_screener.reporting.report as report_mod
from swing_screener.selection.eval_cache import (
    EVALUATION_CACHE_SCHEMA_VERSION,
    EvalCache,
    EvaluationCacheIdentity,
    build_evaluation_cache_identities,
    strategy_signature,
)
from swing_screener.strategy.report_config import ReportConfig


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
        base,
        signals=dataclasses.replace(
            base.signals, breakout_lookback=base.signals.breakout_lookback + 10
        ),
    )
    assert strategy_signature(base) != strategy_signature(changed)


def _records(tickers):
    return pd.DataFrame(
        {"mom_6m": [1.0] * len(tickers), "is_eligible": [True] * len(tickers)},
        index=pd.Index([t.upper() for t in tickers], name="ticker"),
    )


def _identity(**changes):
    values = {
        "schema_version": EVALUATION_CACHE_SCHEMA_VERSION,
        "asof": "2026-06-16",
        "last_bar": "2026-06-16T20:00:00+00:00",
        "market_phase": "final_close",
        "strategy_signature": "abc",
        "input_fingerprint": "bars-v1",
    }
    values.update(changes)
    return EvaluationCacheIdentity(**values)


def test_split_all_miss_when_empty(tmp_path):
    cache = EvalCache(root=tmp_path)
    identities = {ticker: _identity() for ticker in ["AAPL", "MSFT"]}
    hits, misses = cache.split(["AAPL", "MSFT"], identities=identities)
    assert hits.empty
    assert sorted(misses) == ["AAPL", "MSFT"]


def test_write_then_split_hits(tmp_path):
    cache = EvalCache(root=tmp_path)
    identities = {ticker: _identity() for ticker in ["AAPL", "MSFT", "NVDA"]}
    cache.write(_records(["AAPL", "MSFT"]), identities=identities)
    hits, misses = cache.split(["AAPL", "MSFT", "NVDA"], identities=identities)
    assert sorted(hits.index.tolist()) == ["AAPL", "MSFT"]
    assert misses == ["NVDA"]
    assert hits.loc["AAPL", "mom_6m"] == 1.0
    assert not any(column.startswith("__eval_cache_") for column in hits.columns)


def test_split_misses_when_identity_provenance_changes(tmp_path):
    cache = EvalCache(root=tmp_path)
    cache.write(_records(["AAPL"]), identities={"AAPL": _identity()})

    changes = [
        {"schema_version": EVALUATION_CACHE_SCHEMA_VERSION + 1},
        {"asof": "2026-06-17"},
        {"last_bar": "2026-06-16T19:30:00+00:00"},
        {"market_phase": "intraday"},
        {"strategy_signature": "zzz"},
        {"input_fingerprint": "bars-v2"},
    ]
    for change in changes:
        hits, misses = cache.split(["AAPL"], identities={"AAPL": _identity(**change)})
        assert hits.empty
        assert misses == ["AAPL"]


def test_legacy_entry_without_identity_metadata_is_a_miss(tmp_path):
    cache = EvalCache(root=tmp_path)
    identity = _identity()
    path = cache._path("AAPL", identity.asof, identity.strategy_signature)
    path.parent.mkdir(parents=True)
    _records(["AAPL"]).to_parquet(path)

    hits, misses = cache.split(["AAPL"], identities={"AAPL": identity})

    assert hits.empty
    assert misses == ["AAPL"]


def test_identity_fingerprint_changes_with_symbol_or_sector_inputs():
    index = pd.to_datetime(["2026-06-15", "2026-06-16"], utc=True)
    ohlcv = pd.DataFrame(
        {
            ("Close", "AAPL"): [100.0, 101.0],
            ("Volume", "AAPL"): [1_000.0, 2_000.0],
        },
        index=index,
    )
    ohlcv.columns = pd.MultiIndex.from_tuples(ohlcv.columns)

    base = build_evaluation_cache_identities(
        ohlcv,
        ["AAPL"],
        asof="2026-06-16",
        market_phase="final_close",
        strategy_signature="abc",
        sector_benchmark_returns={"AAPL": 0.03},
    )["AAPL"]
    changed_bar = ohlcv.copy()
    changed_bar.loc[index[-1], ("Close", "AAPL")] = 102.0
    bar_identity = build_evaluation_cache_identities(
        changed_bar,
        ["AAPL"],
        asof="2026-06-16",
        market_phase="final_close",
        strategy_signature="abc",
        sector_benchmark_returns={"AAPL": 0.03},
    )["AAPL"]
    sector_identity = build_evaluation_cache_identities(
        ohlcv,
        ["AAPL"],
        asof="2026-06-16",
        market_phase="final_close",
        strategy_signature="abc",
        sector_benchmark_returns={"AAPL": 0.04},
    )["AAPL"]

    assert base.last_bar == "2026-06-16T00:00:00+00:00"
    assert base.input_fingerprint != bar_identity.input_fingerprint
    assert base.input_fingerprint != sector_identity.input_fingerprint


def test_identity_ignores_unconsumed_nan_sector_input():
    index = pd.to_datetime(["2026-06-16"], utc=True)
    ohlcv = pd.DataFrame({("Close", "AAPL"): [101.0]}, index=index)
    ohlcv.columns = pd.MultiIndex.from_tuples(ohlcv.columns)
    kwargs = {
        "asof": "2026-06-16",
        "market_phase": "final_close",
        "strategy_signature": "abc",
    }

    missing = build_evaluation_cache_identities(ohlcv, ["AAPL"], **kwargs)["AAPL"]
    unavailable = build_evaluation_cache_identities(
        ohlcv,
        ["AAPL"],
        sector_benchmark_returns={"AAPL": float("nan")},
        **kwargs,
    )["AAPL"]

    assert unavailable.input_fingerprint == missing.input_fingerprint


def test_write_preserves_numeric_dtype(tmp_path):
    """records.loc[[ticker]] preserves column dtypes; iterrows+to_frame().T yields object dtype."""
    records = pd.DataFrame(
        {
            "mom_6m": [1.5, 2.5],
            "is_eligible": [True, False],
            "currency": ["USD", "EUR"],
        },
        index=pd.Index(["AAPL", "MSFT"], name="ticker"),
    )
    # The fix: slicing with loc[[ticker]] must preserve float64
    for ticker in records.index:
        frame = records.loc[[ticker]]
        assert pd.api.types.is_float_dtype(
            frame["mom_6m"]
        ), f"loc[[ticker]] yielded {frame['mom_6m'].dtype} for {ticker}; expected float64"
    # End-to-end: write then split must also round-trip correctly
    cache = EvalCache(root=tmp_path)
    identities = {ticker: _identity() for ticker in ["AAPL", "MSFT"]}
    cache.write(records, identities=identities)
    hits, _ = cache.split(["AAPL", "MSFT"], identities=identities)
    assert pd.api.types.is_float_dtype(
        hits["mom_6m"]
    ), f"expected float64, got {hits['mom_6m'].dtype}"
    assert hits.loc["AAPL", "mom_6m"] == 1.5
    assert hits.index.name == "ticker"


def test_prune_removes_old_files(tmp_path):
    cache = EvalCache(root=tmp_path)
    identities = {ticker: _identity() for ticker in ["AAPL", "MSFT"]}
    cache.write(_records(["AAPL"]), identities=identities)
    path = cache._path("AAPL", "2026-06-16", "abc")
    old = time.time() - 25 * 3600
    os.utime(path, (old, old))
    cache.write(_records(["MSFT"]), identities=identities)  # fresh
    cache.prune(max_age_sec=24 * 3600)
    assert not path.exists()
    assert cache._path("MSFT", "2026-06-16", "abc").exists()


def test_build_daily_report_reuses_only_exact_input_identity(tmp_path, monkeypatch):
    cache = EvalCache(root=tmp_path)
    calls = []

    def fake_compute(
        ohlcv,
        cfg,
        sector_benchmark_returns=None,
        quote_to_eur_rates=None,
    ):
        tks = [str(c) for c in ohlcv["Close"].columns]
        calls.append(tuple(sorted(tks)))
        return _records(tks)

    monkeypatch.setattr(
        "swing_screener.strategy.modules.momentum.compute_symbol_records", fake_compute
    )

    ohlcv = pd.DataFrame({("Close", "AAPL"): [1.0], ("Close", "MSFT"): [1.0]})
    ohlcv.columns = pd.MultiIndex.from_tuples(ohlcv.columns)

    report_mod.build_daily_report(
        ohlcv,
        eval_cache=cache,
        asof_date="2026-06-16",
        market_phase="final_close",
    )
    report_mod.build_daily_report(
        ohlcv,
        eval_cache=cache,
        asof_date="2026-06-16",
        market_phase="final_close",
    )

    assert calls[0] == ("AAPL", "MSFT")
    assert len(calls) == 1

    report_mod.build_daily_report(
        ohlcv,
        eval_cache=cache,
        asof_date="2026-06-16",
        market_phase="intraday",
    )
    assert len(calls) == 2

    changed = ohlcv.copy()
    changed.loc[0, ("Close", "AAPL")] = 2.0
    report_mod.build_daily_report(
        changed,
        eval_cache=cache,
        asof_date="2026-06-16",
        market_phase="intraday",
    )
    assert calls[-1] == ("AAPL",)
