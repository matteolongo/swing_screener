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
        feature_cols = [
            "mom_6m",
            "mom_12m",
            "rs_6m",
            "atr14",
            "atr_pct",
            "last",
            "currency",
            "dist_sma50_pct",
            "dist_sma200_pct",
            "trend_ok",
            "is_eligible",
            "signal",
        ]
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
    monkeypatch.setattr(
        screener_svc_mod, "get_multiple_ticker_info", lambda tickers: {}
    )
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
    from swing_screener.selection.universe import (
        UniverseConfig as SelectionUniverseConfig,
    )
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
    all_computed_run1 = (
        set().union(*computed_after_run1) if computed_after_run1 else set()
    )
    assert (
        "AAA" in all_computed_run1
    ), f"Run 1 should compute AAA; got {computed_after_run1}"
    assert (
        "BBB" in all_computed_run1
    ), f"Run 1 should compute BBB; got {computed_after_run1}"

    # Run 2 must NOT recompute BBB (cache hit) and MUST compute CCC (cache miss).
    all_computed_run2 = (
        set().union(*computed_after_run2) if computed_after_run2 else set()
    )
    assert (
        "CCC" in all_computed_run2
    ), f"Run 2 should compute CCC; got {computed_after_run2}"
    assert (
        "BBB" not in all_computed_run2
    ), f"Run 2 should reuse cached BBB but recomputed it; got {computed_after_run2}"


def test_force_refresh_bypasses_cache(tmp_path, monkeypatch):
    """force_refresh=True must recompute all symbols even when the cache is warm.

    Warm the cache with a run over AAA + BBB.  Clear the spy.  Re-run the same
    set with force_refresh=True.  Every symbol must appear in the spy again.
    """
    import api.services.screener_service as screener_svc_mod
    import swing_screener.strategy.modules.momentum as momentum_mod

    tickers = ["AAA", "BBB", "SPY"]
    ohlcv = _make_ohlcv(tickers)

    svc, _eval_cache, _mock_provider = _make_screener_service(tmp_path)

    import json

    computed_tickers: list[set] = []

    def _spying_compute(ohlcv_arg, cfg, sector_benchmark_returns=None):
        if "Close" in set(ohlcv_arg.columns.get_level_values(0)):
            close_tickers = set(ohlcv_arg["Close"].columns.tolist())
        else:
            close_tickers = set()
        computed_tickers.append(close_tickers)
        tickers_list = sorted(close_tickers)
        feature_cols = [
            "mom_6m",
            "mom_12m",
            "rs_6m",
            "atr14",
            "atr_pct",
            "last",
            "currency",
            "dist_sma50_pct",
            "dist_sma200_pct",
            "trend_ok",
            "is_eligible",
            "signal",
        ]
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
        return pd.DataFrame(data, index=pd.Index(tickers_list, name="ticker"))

    monkeypatch.setattr(momentum_mod, "compute_symbol_records", _spying_compute)

    monkeypatch.setattr(
        screener_svc_mod, "get_multiple_ticker_info", lambda tickers: {}
    )
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
    from swing_screener.recommendation.priority import CombinedPriorityConfig
    from api.services.screener_service import _RunContext
    from api.models.screener import ScreenerRequest

    def _make_ctx(tickers_list, ohlcv_df, asof="2024-01-05", force_refresh=False):
        req = ScreenerRequest(asof_date=asof, top=10, force_refresh=force_refresh)
        ctx = _RunContext(
            request=req, strategy={}, combined_priority_cfg=CombinedPriorityConfig()
        )
        ctx.ohlcv = ohlcv_df
        ctx.asof_str = asof
        ctx.screening_tickers = [t for t in tickers_list if t != "SPY"]
        ctx.report_cfg = ReportConfig()
        ctx.ticker_info = {}
        ctx.sector_rotation_by_name = {}
        return ctx

    # Warm cache.
    ctx1 = _make_ctx(tickers, ohlcv)
    svc._run_daily_report(ctx1, requested_top=10)
    computed_tickers.clear()

    # Re-run with force_refresh=True over the same symbols.
    ctx2 = _make_ctx(tickers, ohlcv, force_refresh=True)
    svc._run_daily_report(ctx2, requested_top=10)

    all_computed = set().union(*computed_tickers) if computed_tickers else set()
    assert (
        "AAA" in all_computed
    ), f"force_refresh should recompute AAA; got {computed_tickers}"
    assert (
        "BBB" in all_computed
    ), f"force_refresh should recompute BBB; got {computed_tickers}"


def test_daily_review_reuses_manual_screen_cache(tmp_path, monkeypatch):
    """DailyReviewService reuses cached eval results from a prior manual screen.

    Both services share the same EvalCache root.  The manual screen warms the
    cache for AAA + BBB.  The daily-review run covers the same symbols.
    compute_symbol_records must NOT be called for the overlapping tickers.

    If the two entry points resolve different asof strings or cache signatures,
    this test reports the mismatch rather than silently passing.
    """
    import api.services.screener_service as screener_svc_mod
    import swing_screener.strategy.modules.momentum as momentum_mod
    from api.services.daily_review_service import DailyReviewService
    from api.services.screener_service import ScreenerService, _RunContext
    from api.repositories.strategy_repo import StrategyRepository
    from api.services.portfolio_service import PortfolioService
    from swing_screener.selection.eval_cache import EvalCache
    from swing_screener.data.source_health import DataSourceHealth
    from swing_screener.data.providers import MarketDataProvider
    from swing_screener.strategy.report_config import ReportConfig
    from swing_screener.recommendation.priority import CombinedPriorityConfig
    from api.models.screener import ScreenerRequest
    from api.models.portfolio import PositionsResponse

    ASOF = "2024-01-05"
    tickers = ["AAA", "BBB", "SPY"]
    ohlcv = _make_ohlcv(tickers)

    # Shared EvalCache backed by tmp_path.
    shared_cache = EvalCache(root=tmp_path / "eval_cache")

    # --- Spy on compute_symbol_records ---
    import json

    computed_tickers: list[set] = []

    def _spying_compute(ohlcv_arg, cfg, sector_benchmark_returns=None):
        if "Close" in set(ohlcv_arg.columns.get_level_values(0)):
            close_tickers = set(ohlcv_arg["Close"].columns.tolist())
        else:
            close_tickers = set()
        computed_tickers.append(close_tickers)
        tickers_list = sorted(close_tickers)
        feature_cols = [
            "mom_6m",
            "mom_12m",
            "rs_6m",
            "atr14",
            "atr_pct",
            "last",
            "currency",
            "dist_sma50_pct",
            "dist_sma200_pct",
            "trend_ok",
            "is_eligible",
            "signal",
        ]
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
        return pd.DataFrame(data, index=pd.Index(tickers_list, name="ticker"))

    monkeypatch.setattr(momentum_mod, "compute_symbol_records", _spying_compute)

    monkeypatch.setattr(
        screener_svc_mod, "get_multiple_ticker_info", lambda tickers: {}
    )
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

    def _make_ctx(tickers_list, ohlcv_df, asof=ASOF):
        req = ScreenerRequest(asof_date=asof, top=10)
        ctx = _RunContext(
            request=req, strategy={}, combined_priority_cfg=CombinedPriorityConfig()
        )
        ctx.ohlcv = ohlcv_df
        ctx.asof_str = asof
        ctx.screening_tickers = [t for t in tickers_list if t != "SPY"]
        ctx.report_cfg = ReportConfig()
        ctx.ticker_info = {}
        ctx.sector_rotation_by_name = {}
        return ctx

    # --- Build manual ScreenerService (same cache) ---
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

    manual_svc = ScreenerService(
        strategy_repo=mock_strategy_repo,
        portfolio_service=mock_portfolio,
        provider=mock_provider,
        eval_cache=shared_cache,
    )

    # --- Warm cache via manual screen ---
    ctx_warm = _make_ctx(tickers, ohlcv)
    manual_svc._run_daily_report(ctx_warm, requested_top=10)

    computed_after_warmup = list(computed_tickers)
    all_warmed = set().union(*computed_after_warmup) if computed_after_warmup else set()
    assert (
        "AAA" in all_warmed and "BBB" in all_warmed
    ), f"Warmup must compute AAA and BBB; got {computed_after_warmup}"
    computed_tickers.clear()

    # --- Build DailyReviewService whose screener shares the same EvalCache ---
    dr_portfolio = MagicMock(spec=PortfolioService)
    dr_portfolio.list_positions.return_value = PositionsResponse(
        positions=[], asof="2024-01-05"
    )

    dr_screener = ScreenerService(
        strategy_repo=mock_strategy_repo,
        portfolio_service=mock_portfolio,
        provider=mock_provider,
        eval_cache=shared_cache,
    )

    # Patch run_screener on the dr_screener so it uses our pre-built ctx
    # (bypasses network IO) while still going through _run_daily_report which
    # is where the EvalCache hit/miss decision happens.
    from api.models.screener import ScreenerResponse

    def _patched_run_screener(request, strategy_override=None):
        ctx = _make_ctx(tickers, ohlcv, asof=ASOF)
        dr_screener._run_daily_report(ctx, requested_top=10)
        return ScreenerResponse(
            candidates=[], asof_date=ASOF, total_screened=len(tickers)
        )

    monkeypatch.setattr(dr_screener, "run_screener", _patched_run_screener)

    daily_svc = DailyReviewService(
        screener_service=dr_screener,
        portfolio_service=dr_portfolio,
        data_dir=tmp_path / "daily_reviews",
    )

    daily_svc.generate_daily_review(top_n=10)

    computed_after_dr = list(computed_tickers)
    all_computed_dr = set().union(*computed_after_dr) if computed_after_dr else set()

    # Neither AAA nor BBB should have been recomputed — they're both cache hits.
    assert (
        "AAA" not in all_computed_dr
    ), f"daily-review should reuse cached AAA but recomputed it; got {computed_after_dr}"
    assert (
        "BBB" not in all_computed_dr
    ), f"daily-review should reuse cached BBB but recomputed it; got {computed_after_dr}"


# ---------------------------------------------------------------------------
# Taxonomy pool pre-filter (_resolve_universe_and_window)
# ---------------------------------------------------------------------------


class _FakePoolRepo:
    def __init__(self, symbols):
        self._symbols = symbols

    def list_symbols(self):
        return self._symbols


class _FakeReviewRepo:
    def __init__(self, queued=None):
        # `queued` is a list of {"symbol": ...} dicts or plain symbol strings.
        self._queued = {
            (q["symbol"] if isinstance(q, dict) else q).upper() for q in (queued or [])
        }

    def queued_symbols(self, threshold):
        return set(self._queued)

    def apply_fetch_results(self, ok, failed, asof, threshold):
        return None


def _pool_symbol(symbol, **kw):
    base = {
        "symbol": symbol,
        "region": "us",
        "available_providers": ["yfinance"],
        "primary_provider": "yfinance",
        "index_memberships": [],
    }
    base.update(kw)
    return base


def _make_screener_service_with_pool(tmp_path, symbols, queue=None):
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
        delay_policy="test",
    )
    return ScreenerService(
        strategy_repo=mock_strategy_repo,
        portfolio_service=mock_portfolio,
        provider=mock_provider,
        eval_cache=EvalCache(root=tmp_path / "eval_cache"),
        pool_repo=_FakePoolRepo(symbols),
        review_repo=_FakeReviewRepo(queue),
    )


def test_fetch_ohlcv_chunked_forwards_force_refresh():
    """_fetch_ohlcv_chunked must pass force_refresh through to provider.fetch_ohlcv."""
    from unittest.mock import MagicMock
    from api.services.screener_service import _fetch_ohlcv_chunked
    from swing_screener.data.providers import MarketDataProvider

    ohlcv = _make_ohlcv(["AAA", "BBB"])

    mock_provider = MagicMock(spec=MarketDataProvider)
    mock_provider.fetch_ohlcv.return_value = ohlcv

    tickers = ["AAA", "BBB"]
    _fetch_ohlcv_chunked(
        mock_provider,
        tickers,
        start_date="2024-01-01",
        end_date="2024-01-05",
        chunk_size=100,
        force_refresh=True,
    )

    assert mock_provider.fetch_ohlcv.call_count == 1
    _, kwargs = mock_provider.fetch_ohlcv.call_args
    assert (
        kwargs.get("force_refresh") is True
    ), f"expected force_refresh=True forwarded to provider; got {kwargs}"


def test_resolve_universe_prefilters_from_pool(tmp_path):
    from api.services.screener_service import _RunContext
    from api.models.screener import ScreenerRequest, TaxonomyFilter

    symbols = [
        _pool_symbol("AAPL", region="us"),
        _pool_symbol("ASML", region="europe"),
        _pool_symbol("TSM", region="asia_pacific"),
    ]
    svc = _make_screener_service_with_pool(tmp_path, symbols)
    req = ScreenerRequest(taxonomy_filter=TaxonomyFilter(region=["us"]), top=5)
    ctx = _RunContext(request=req, strategy={})
    svc._resolve_universe_and_window(ctx)
    assert "AAPL" in ctx.screening_tickers
    assert "ASML" not in ctx.screening_tickers
    assert "TSM" not in ctx.screening_tickers


def test_resolve_universe_excludes_review_queue(tmp_path):
    from api.services.screener_service import _RunContext
    from api.models.screener import ScreenerRequest, TaxonomyFilter

    symbols = [_pool_symbol("AAPL", region="us"), _pool_symbol("MSFT", region="us")]
    svc = _make_screener_service_with_pool(
        tmp_path, symbols, queue=[{"symbol": "AAPL"}]
    )
    req = ScreenerRequest(taxonomy_filter=TaxonomyFilter(region=["us"]), top=5)
    ctx = _RunContext(request=req, strategy={})
    svc._resolve_universe_and_window(ctx)
    assert "AAPL" not in ctx.screening_tickers
    assert "MSFT" in ctx.screening_tickers


def test_universe_alias_maps_to_index_membership(tmp_path):
    from api.services.screener_service import _RunContext
    from api.models.screener import ScreenerRequest

    symbols = [
        _pool_symbol("AAPL", index_memberships=["us_sp500"]),
        _pool_symbol("XYZ", index_memberships=["other_index"]),
    ]
    svc = _make_screener_service_with_pool(tmp_path, symbols)
    req = ScreenerRequest(universe="us_sp500", top=5)
    ctx = _RunContext(request=req, strategy={})
    svc._resolve_universe_and_window(ctx)
    assert "AAPL" in ctx.screening_tickers
    assert "XYZ" not in ctx.screening_tickers


def test_record_fetch_health_enqueues_on_threshold(tmp_path):
    import json

    from api.services.screener_service import ScreenerService, _RunContext
    from api.repositories.strategy_repo import StrategyRepository
    from api.repositories.symbol_pool_repo import SymbolPoolRepository
    from api.repositories.review_queue_repo import ReviewQueueRepository
    from api.services.portfolio_service import PortfolioService
    from api.models.screener import ScreenerRequest
    from swing_screener.selection.eval_cache import EvalCache
    from swing_screener.data.providers import MarketDataProvider

    pool_path = tmp_path / "symbol_pool.json"
    pool_path.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "asof": "2026-06-29",
                "symbols": [{"symbol": "AAPL"}, {"symbol": "MSFT"}],
            }
        ),
        encoding="utf-8",
    )
    # Review queue: AAPL already failed twice (count 2, below threshold 3).
    queue_path = tmp_path / "review_queue.json"
    queue_path.write_text(
        json.dumps({"symbols": {"AAPL": {"symbol": "AAPL", "fetch_failure_count": 2}}}),
        encoding="utf-8",
    )

    mock_strategy_repo = MagicMock(spec=StrategyRepository)
    mock_portfolio = MagicMock(spec=PortfolioService)
    mock_provider = MagicMock(spec=MarketDataProvider)
    mock_provider.get_provider_name.return_value = "mock"

    review_repo = ReviewQueueRepository(queue_path)
    svc = ScreenerService(
        strategy_repo=mock_strategy_repo,
        portfolio_service=mock_portfolio,
        provider=mock_provider,
        eval_cache=EvalCache(root=tmp_path / "eval_cache"),
        pool_repo=SymbolPoolRepository(pool_path),
        review_repo=review_repo,
    )

    # OHLCV contains MSFT only → AAPL failed this run, crossing 2 -> 3 (threshold 3).
    idx = pd.date_range("2024-01-01", periods=2, freq="B")
    cols = pd.MultiIndex.from_tuples([("Close", "MSFT")], names=["field", "ticker"])
    ohlcv = pd.DataFrame([[10.0], [10.5]], index=idx, columns=cols)

    req = ScreenerRequest(top=5)
    ctx = _RunContext(request=req, strategy={})
    ctx.ohlcv = ohlcv
    ctx.screening_tickers = ["AAPL", "MSFT"]
    ctx.asof_str = "2026-06-30"

    svc._record_fetch_health(ctx)

    assert review_repo.queued_symbols(3) == {"AAPL"}
    # The committed pool file is never mutated by a screener run.
    pool_data = json.loads(pool_path.read_text(encoding="utf-8"))
    assert all("fetch_failure_count" not in s for s in pool_data["symbols"])


def test_record_fetch_health_skips_increment_on_systemic_outage(tmp_path):
    import json

    from api.services.screener_service import ScreenerService, _RunContext
    from api.repositories.strategy_repo import StrategyRepository
    from api.repositories.symbol_pool_repo import SymbolPoolRepository
    from api.repositories.review_queue_repo import ReviewQueueRepository
    from api.services.portfolio_service import PortfolioService
    from api.models.screener import ScreenerRequest
    from swing_screener.selection.eval_cache import EvalCache
    from swing_screener.data.providers import MarketDataProvider

    pool_path = tmp_path / "symbol_pool.json"
    pool_path.write_text(
        json.dumps({"schema_version": 1, "symbols": []}), encoding="utf-8"
    )
    queue_path = tmp_path / "review_queue.json"

    review_repo = ReviewQueueRepository(queue_path)
    svc = ScreenerService(
        strategy_repo=MagicMock(spec=StrategyRepository),
        portfolio_service=MagicMock(spec=PortfolioService),
        provider=MagicMock(spec=MarketDataProvider),
        eval_cache=EvalCache(root=tmp_path / "eval_cache"),
        pool_repo=SymbolPoolRepository(pool_path),
        review_repo=review_repo,
    )

    # 12 screening tickers, OHLCV only returns 5 (>50% missing on a >=10 batch)
    # -> systemic-outage guard skips all increments.
    requested = [f"T{i}" for i in range(12)]
    present = requested[:5]
    idx = pd.date_range("2024-01-01", periods=2, freq="B")
    cols = pd.MultiIndex.from_tuples(
        [("Close", t) for t in present], names=["field", "ticker"]
    )
    ohlcv = pd.DataFrame(
        [[1.0] * len(present), [1.1] * len(present)], index=idx, columns=cols
    )

    ctx = _RunContext(request=ScreenerRequest(top=5), strategy={})
    ctx.ohlcv = ohlcv
    ctx.screening_tickers = requested
    ctx.asof_str = "2026-06-30"

    svc._record_fetch_health(ctx)
    assert review_repo.read().get("symbols", {}) == {}
