import pandas as pd
import pytest
from dataclasses import field as dc_field
from unittest.mock import MagicMock

from swing_screener.data.price_history import price_history_map


def _ohlcv():
    idx = pd.date_range("2024-01-01", periods=3, freq="B")
    cols = pd.MultiIndex.from_tuples(
        [
            ("Open", "AAA"),
            ("High", "AAA"),
            ("Low", "AAA"),
            ("Close", "AAA"),
            ("Volume", "AAA"),
        ],
        names=["field", "ticker"],
    )
    return pd.DataFrame(
        [
            [9.5, 10.2, 9.4, 10.0, 1000],
            [10.0, 10.5, 9.8, 10.3, 1200],
            [10.3, 10.6, 10.0, 10.4, 1100],
        ],
        index=idx,
        columns=cols,
    )


def test_price_history_map_includes_ohlcv():
    out = price_history_map(_ohlcv(), tickers=["AAA"])
    point = out["AAA"][0]
    assert point["close"] == 10.0
    assert point["open"] == 9.5
    assert point["high"] == 10.2
    assert point["low"] == 9.4
    assert point["volume"] == 1000


def test_price_history_map_close_only_when_ohlc_absent():
    idx = pd.date_range("2024-01-01", periods=2, freq="B")
    cols = pd.MultiIndex.from_tuples([("Close", "AAA")], names=["field", "ticker"])
    df = pd.DataFrame([[10.0], [10.5]], index=idx, columns=cols)
    out = price_history_map(df, tickers=["AAA"])
    point = out["AAA"][0]
    assert point["close"] == 10.0
    assert "open" not in point and "volume" not in point


# ---------------------------------------------------------------------------
# EvalCache integration test for ScreenerService
# ---------------------------------------------------------------------------


def _make_ohlcv(tickers: list[str], periods: int = 3) -> pd.DataFrame:
    """Build a minimal MultiIndex OHLCV DataFrame for a given ticker list."""
    idx = pd.date_range("2024-01-01", periods=periods, freq="B")
    data = {}
    for field in ("Open", "High", "Low", "Close", "Volume"):
        for ticker in tickers:
            price = 50.0
            data[(field, ticker)] = [price] * periods
    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns, names=["field", "ticker"])
    return df


def _make_screener_service(tmp_path):
    """Build a ScreenerService with minimal stubs and a tmp_path-backed EvalCache."""
    from api.services.screener_service import ScreenerService
    from api.repositories.strategy_repo import StrategyRepository
    from api.services.portfolio_service import PortfolioService
    from swing_screener.selection.eval_cache import EvalCache
    from swing_screener.data.source_health import DataSourceHealth
    from swing_screener.data.providers import MarketDataProvider

    mock_strategy_repo = MagicMock(spec=StrategyRepository)
    mock_strategy_repo.get_active_strategy.return_value = {}

    mock_portfolio = MagicMock(spec=PortfolioService)
    mock_portfolio.list_positions.return_value = MagicMock(positions=[])

    mock_provider = MagicMock(spec=MarketDataProvider)
    mock_provider.get_provider_name.return_value = "mock"
    mock_provider.get_source_health.return_value = DataSourceHealth(
        provider="mock",
        domain="market_data",
        status="ok",
        quality_score=0.7,
        delay_policy="test_fixture",
    )

    eval_cache = EvalCache(root=tmp_path / "eval_cache")

    svc = ScreenerService(
        strategy_repo=mock_strategy_repo,
        portfolio_service=mock_portfolio,
        provider=mock_provider,
        eval_cache=eval_cache,
    )
    return svc, eval_cache, mock_provider


def test_mixed_universe_reuses_cached_symbols(tmp_path, monkeypatch):
    """Second screener run recomputes ONLY symbols not yet in the cache.

    First run: AAA + BBB + SPY (benchmark). Second run: BBB + CCC + SPY.
    After the first run writes AAA and BBB to cache, the second run should
    call compute_symbol_records only for CCC, not for BBB.
    """
    import api.services.screener_service as screener_svc_mod
    import swing_screener.strategy.modules.momentum as momentum_mod

    run1_tickers = ["AAA", "BBB", "SPY"]
    run2_tickers = ["BBB", "CCC", "SPY"]

    ohlcv1 = _make_ohlcv(run1_tickers)
    ohlcv2 = _make_ohlcv(run2_tickers)

    svc, eval_cache, mock_provider = _make_screener_service(tmp_path)

    # Track which tickers compute_symbol_records receives across calls.
    # Return a fake DataFrame with the minimal columns needed for caching and
    # downstream ranking (must have is_eligible, mom_6m, mom_12m, rs_6m so
    # build_momentum_report can rank and write to cache).
    import json
    computed_tickers: list[set] = []

    def _spying_compute(ohlcv, cfg, sector_benchmark_returns=None):
        if "Close" in set(ohlcv.columns.get_level_values(0)):
            close_tickers = set(ohlcv["Close"].columns.tolist())
        else:
            close_tickers = set()
        computed_tickers.append(close_tickers)
        # Return a minimal but valid records DataFrame so the cache can write.
        tickers_list = sorted(close_tickers)
        feature_cols = ["mom_6m", "mom_12m", "rs_6m", "atr14", "atr_pct",
                        "last", "currency", "dist_sma50_pct", "dist_sma200_pct",
                        "trend_ok", "is_eligible", "signal"]
        data = {
            "mom_6m": [0.10] * len(tickers_list),
            "mom_12m": [0.20] * len(tickers_list),
            "rs_6m": [0.05] * len(tickers_list),
            "atr14": [1.0] * len(tickers_list),
            "atr_pct": [0.02] * len(tickers_list),
            "last": [50.0] * len(tickers_list),
            "currency": ["USD"] * len(tickers_list),
            "dist_sma50_pct": [5.0] * len(tickers_list),
            "dist_sma200_pct": [10.0] * len(tickers_list),
            "trend_ok": [True] * len(tickers_list),
            "is_eligible": [True] * len(tickers_list),
            "signal": ["breakout"] * len(tickers_list),
            "__feature_cols__": [json.dumps(feature_cols)] * len(tickers_list),
        }
        return pd.DataFrame(
            data,
            index=pd.Index(tickers_list, name="ticker"),
        )

    monkeypatch.setattr(momentum_mod, "compute_symbol_records", _spying_compute)

    # Stub out the heavy / network-dependent parts of _run_daily_report.
    monkeypatch.setattr(screener_svc_mod, "get_multiple_ticker_info", lambda tickers: {})
    monkeypatch.setattr(
        screener_svc_mod.sector_rotation,
        "compute_sector_benchmark_returns",
        lambda ohlcv: {},
    )
    monkeypatch.setattr(
        screener_svc_mod.sector_rotation,
        "compute_sector_rotation_scores",
        lambda ohlcv: {},
    )
    monkeypatch.setattr(
        screener_svc_mod.sector_rotation,
        "build_ticker_sector_returns",
        lambda ticker_sectors, etf_returns: {},
    )

    from swing_screener.strategy.report_config import ReportConfig
    from swing_screener.selection.universe import UniverseConfig as SelectionUniverseConfig
    from swing_screener.selection.entries import EntrySignalConfig
    from swing_screener.selection.ranking import RankingConfig
    from swing_screener.risk.position_sizing import RiskConfig
    from api.services.screener_service import _RunContext
    from api.models.screener import ScreenerRequest

    def _make_ctx(tickers, ohlcv, asof="2024-01-05"):
        req = ScreenerRequest(asof_date=asof, top=10)
        cfg = ReportConfig()
        ctx = _RunContext(
            request=req,
            strategy={},
        )
        ctx.ohlcv = ohlcv
        ctx.asof_str = asof
        ctx.screening_tickers = [t for t in tickers if t != "SPY"]
        ctx.report_cfg = cfg
        ctx.ticker_info = {}
        ctx.sector_rotation_by_name = {}
        from swing_screener.recommendation.priority import CombinedPriorityConfig
        ctx.combined_priority_cfg = CombinedPriorityConfig()
        return ctx

    # Run 1: AAA + BBB → both computed and written to cache.
    ctx1 = _make_ctx(run1_tickers, ohlcv1)
    svc._run_daily_report(ctx1, requested_top=10)

    computed_after_run1 = list(computed_tickers)
    computed_tickers.clear()

    # Run 2: BBB + CCC → BBB is a cache hit, only CCC should be recomputed.
    ctx2 = _make_ctx(run2_tickers, ohlcv2)
    svc._run_daily_report(ctx2, requested_top=10)

    computed_after_run2 = list(computed_tickers)

    # Run 1 must have computed at least AAA and BBB (SPY is the benchmark and
    # excluded from screening, so it may or may not appear).
    all_computed_run1 = set().union(*computed_after_run1) if computed_after_run1 else set()
    assert "AAA" in all_computed_run1, f"Run 1 should compute AAA; got {computed_after_run1}"
    assert "BBB" in all_computed_run1, f"Run 1 should compute BBB; got {computed_after_run1}"

    # Run 2 must NOT recompute BBB (cache hit) and MUST compute CCC (cache miss).
    all_computed_run2 = set().union(*computed_after_run2) if computed_after_run2 else set()
    assert "CCC" in all_computed_run2, f"Run 2 should compute CCC; got {computed_after_run2}"
    assert "BBB" not in all_computed_run2, (
        f"Run 2 should reuse cached BBB but recomputed it; got {computed_after_run2}"
    )
