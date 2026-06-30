"""Screener service."""

from __future__ import annotations

from dataclasses import replace, asdict, dataclass, field
from typing import Optional
import datetime as dt
from datetime import datetime
import logging
import os

import pandas as pd
from swing_screener.errors import (
    DomainError,
    NotFoundError,
    ValidationError,
    UnprocessableError,
    ServiceError,
)

from api.models.screener import (
    ScreenerRequest,
    ScreenerRunLaunchResponse,
    ScreenerRunStatusResponse,
    ScreenerResponse,
    ScreenerCandidate,
    CandlePatternOut,
)
from api.models.recommendation import Recommendation
from api.services.portfolio_service import PortfolioService
from api.services.same_symbol_reentry import SameSymbolReentryEvaluator
from swing_screener.risk.engine import RiskEngineConfig, evaluate_recommendation
from swing_screener.indicators.candles import detect_patterns, CandleConfig
from swing_screener.execution.guidance import apply_pattern_stop, ExecutionConfig
from api.repositories.strategy_repo import StrategyRepository
from swing_screener.data.universe import (
    filter_tickers_by_metadata,
    get_instrument_record,
    get_universe_benchmark,
)
from swing_screener.data.symbol_pool import deserialize_pool, filter_pool_by_taxonomy
from swing_screener.data.providers import MarketDataProvider, get_default_provider
from swing_screener.data.currency import detect_currency
from swing_screener.data.ticker_info import get_multiple_ticker_info
from swing_screener.data import sector_rotation
from swing_screener.reporting.report import ReportConfig, build_daily_report
from swing_screener.reporting.concentration import sector_concentration_warnings
from swing_screener.fundamentals.earnings_proximity import fetch_next_earnings_days
from swing_screener.recommendation.priority import (
    CombinedPriorityConfig,
    compute_combined_priority,
)
from swing_screener.settings import get_settings_manager
from swing_screener.strategy.config import (
    build_entry_config,
    build_ranking_config,
    build_risk_config,
    build_universe_config,
)
from swing_screener.risk.regime import compute_regime_risk_multiplier
from api.utils.converters import to_iso as _to_iso
from swing_screener.data.price_history import (
    merge_ohlcv,
    last_bar_map,
    price_history_map,
    price_history_change_pct,
    aligned_benchmark_price_history,
)
from swing_screener.utils.coerce import (
    is_na_scalar,
    safe_float,
    safe_optional_float,
    safe_optional_int,
)
from api.services.decision_context import (
    apply_cached_fundamentals_context,
    apply_decision_priority_ranking,
    apply_decision_summary_context,
    load_fundamentals_snapshots,
    rebuild_recommendations_with_decision_action,
)
from swing_screener.selection.universe import UniverseConfig as SelectionUniverseConfig
from swing_screener.selection.ranking import RankingConfig
from swing_screener.selection.entries import EntrySignalConfig
from swing_screener.risk.position_sizing import RiskConfig
from swing_screener.selection.eval_cache import EvalCache
from swing_screener.selection.screening_window import (
    resolve_screening_currencies,
    resolve_default_asof_date,
    resolve_data_freshness,
    resolve_fetch_start_date,
)

from api.services.screener_run_manager import get_screener_run_manager

logger = logging.getLogger(__name__)


def _min_days_to_earnings_default() -> int:
    selection_defaults = get_settings_manager().get_low_level_defaults_payload(
        "selection"
    )
    universe_defaults = selection_defaults.get("universe", {})
    if not isinstance(universe_defaults, dict):
        return 0
    try:
        return int(universe_defaults.get("min_days_to_earnings", 0))
    except (TypeError, ValueError):
        return 0


def _fetch_ohlcv_chunked(
    provider: MarketDataProvider,
    tickers: list[str],
    start_date: str,
    end_date: str,
    chunk_size: int = 100,
    force_refresh: bool = False,
) -> pd.DataFrame:
    """Fetch OHLCV in chunks using provider."""
    frames: list[pd.DataFrame] = []
    for i in range(0, len(tickers), chunk_size):
        chunk = tickers[i : i + chunk_size]
        df = provider.fetch_ohlcv(
            chunk, start_date=start_date, end_date=end_date, force_refresh=force_refresh
        )
        if df is None or df.empty:
            logger.warning("OHLCV chunk returned empty data (%s)", chunk)
            continue
        frames.append(df)
    if not frames:
        return pd.DataFrame()
    out = frames[0]
    for df in frames[1:]:
        out = merge_ohlcv(out, df)
    return out


@dataclass
class _RunContext:
    """Mutable state accumulated across run_screener pipeline steps.

    Holds everything the steps hand to each other so step signatures stay
    small. Created fresh per run_screener call; never shared across calls.
    """

    request: ScreenerRequest
    strategy: dict
    warnings: list[str] = field(default_factory=list)
    # populated by steps as the run progresses
    universe_cfg: SelectionUniverseConfig | None = None
    signals_cfg: EntrySignalConfig | None = None
    ranking_cfg: RankingConfig | None = None
    risk_cfg: RiskConfig | None = None
    report_cfg: ReportConfig | None = None
    benchmark: str = ""
    tickers: list[str] = field(default_factory=list)
    screening_tickers: list[str] = field(default_factory=list)
    active_currencies: list[str] = field(default_factory=list)
    asof_str: str = ""
    start_date: str = ""
    end_date: str = ""
    market_health: dict = field(default_factory=dict)
    ohlcv: pd.DataFrame | None = None
    last_bar_map: dict = field(default_factory=dict)
    overall_last_bar: pd.Series | None = None
    data_freshness: str = ""
    ticker_info: dict = field(default_factory=dict)
    sector_rotation_by_name: dict = field(default_factory=dict)
    combined_priority_cfg: CombinedPriorityConfig | None = None
    now_utc: datetime | None = None
    benchmark_change_pct: float | None = None
    benchmark_last_bar: pd.Series | None = None
    pool_meta: dict = field(default_factory=dict)


class ScreenerService:
    def __init__(
        self,
        strategy_repo: StrategyRepository,
        portfolio_service: PortfolioService,
        provider: Optional[MarketDataProvider] = None,
        orders_service=None,
        eval_cache: Optional[EvalCache] = None,
        pool_repo=None,
        review_repo=None,
    ) -> None:
        self._strategy_repo = strategy_repo
        self._portfolio_service = portfolio_service
        self._provider = provider or get_default_provider()
        self._orders_service = orders_service
        if eval_cache is not None:
            self._eval_cache: EvalCache = eval_cache
        else:
            self._eval_cache = EvalCache(
                root=get_settings_manager().resolve_runtime_path(
                    "eval_cache_dir", ".cache/eval"
                )
            )
        if pool_repo is not None:
            self._pool_repo = pool_repo
        else:
            from api.repositories.symbol_pool_repo import SymbolPoolRepository

            self._pool_repo = SymbolPoolRepository(
                get_settings_manager().resolve_runtime_path(
                    "symbol_pool_file", "data/symbol_pool.json"
                )
            )
        if review_repo is not None:
            self._review_repo = review_repo
        else:
            from api.repositories.review_queue_repo import ReviewQueueRepository

            self._review_repo = ReviewQueueRepository(
                get_settings_manager().resolve_runtime_path(
                    "review_queue_file", "data/review_queue.json"
                )
            )
        self._available_providers = self._resolve_available_providers()

    @staticmethod
    def _resolve_available_providers() -> set[str]:
        import os

        from swing_screener.integrations.degiro.credentials import (
            credentials_configured,
        )

        available = {"yfinance"}
        if credentials_configured():
            available.add("degiro")
        if os.getenv("POLYGON_IO_API_KEY") or os.getenv("POLYGON_API_KEY"):
            available.add("polygon")
        if os.getenv("EODHD_API_KEY"):
            available.add("eodhd")
        return available

    def _provider_available(self, provider: str | None) -> bool:
        if provider in (None, "yfinance"):
            return True
        return provider in self._available_providers

    @staticmethod
    def _safe_universe_benchmark(universe_id: str) -> str | None:
        try:
            return get_universe_benchmark(universe_id)
        except Exception:  # noqa: BLE001 - unknown id just yields no benchmark override
            return None

    def _build_taxonomy_spec(self, request: ScreenerRequest):
        from api.models.screener import TaxonomyFilter
        from api.services.pool_service import resolve_preset

        base = TaxonomyFilter()
        if request.preset:
            resolved = resolve_preset(request.preset)
            if resolved is not None:
                base = resolved
        if request.taxonomy_filter is not None:
            data = base.model_dump()
            for key, value in request.taxonomy_filter.model_dump().items():
                if value:
                    data[key] = value
            base = TaxonomyFilter(**data)
        if request.universe:  # deprecated alias → index membership
            existing = list(base.index_memberships or [])
            if request.universe not in existing:
                existing.append(request.universe)
            base = base.model_copy(update={"index_memberships": existing})
        spec = base.to_spec()
        # Backward-compat: legacy top-level filter fields map onto unset dimensions
        # (the web UI sends these until the taxonomy filter bar lands).
        overrides: dict = {}
        if spec.currency is None and request.currencies:
            overrides["currency"] = tuple(request.currencies)
        if spec.exchange_mics is None and request.exchange_mics:
            overrides["exchange_mics"] = tuple(request.exchange_mics)
        if spec.instrument_type is None and request.instrument_types:
            overrides["instrument_type"] = tuple(request.instrument_types)
        if overrides:
            spec = replace(spec, **overrides)
        return spec

    def _resolve_strategy(
        self, strategy_id: Optional[str], strategy_override: Optional[dict] = None
    ) -> dict:
        if strategy_override is not None:
            return strategy_override
        if strategy_id:
            strategy = self._strategy_repo.get_strategy(strategy_id)
            if strategy is None:
                raise NotFoundError(f"Strategy not found: {strategy_id}")
            return strategy
        return self._strategy_repo.get_active_strategy()

    def _resolve_universe_and_window(self, ctx: _RunContext) -> int:
        """Resolve strategy, universe, benchmark, ticker list and screening window.

        Returns requested_top. Populates ctx.universe_cfg, benchmark, tickers,
        screening_tickers, active_currencies, asof_str, market_health, now_utc,
        warnings. Raises UnprocessableError on a non-positive top and
        NotFoundError when no tickers survive the taxonomy pre-filter.
        """
        request = ctx.request
        requested_top = request.top or 20
        if requested_top <= 0:
            raise UnprocessableError("top must be >= 1")

        ctx.universe_cfg = build_universe_config(ctx.strategy)
        ctx.now_utc = dt.datetime.now(dt.timezone.utc)
        ctx.benchmark = ctx.universe_cfg.mom.benchmark

        if request.tickers:
            tickers = [t.upper() for t in request.tickers]
            # Apply the same metadata filters as the pool path so explicit-ticker
            # requests still honour currency/exchange/instrument/OTC constraints.
            tickers = filter_tickers_by_metadata(
                tickers,
                currencies=request.currencies,
                exchange_mics=request.exchange_mics,
                include_otc=(
                    request.include_otc if request.include_otc is not None else True
                ),
                instrument_types=request.instrument_types,
            )
            if ctx.benchmark not in tickers:
                tickers.append(ctx.benchmark)
            ctx.tickers = tickers
        else:
            # Deprecated alias: a universe id still informs the benchmark override.
            if request.universe:
                uni_benchmark = self._safe_universe_benchmark(request.universe)
                if uni_benchmark and uni_benchmark != ctx.benchmark:
                    ctx.universe_cfg = replace(
                        ctx.universe_cfg,
                        mom=replace(ctx.universe_cfg.mom, benchmark=uni_benchmark),
                    )
                    ctx.benchmark = uni_benchmark

            from swing_screener.data.symbol_pool import load_symbol_pool_thresholds

            _, _, fail_threshold = load_symbol_pool_thresholds()
            spec = self._build_taxonomy_spec(request)
            pool = deserialize_pool({"symbols": self._pool_repo.list_symbols()})
            ctx.pool_meta = {s.symbol: s for s in pool}
            queued = self._review_repo.queued_symbols(fail_threshold)
            pool = [s for s in pool if s.symbol not in queued]
            pool = [s for s in pool if self._provider_available(s.primary_provider)]
            pool_size = len(pool)
            filtered = filter_pool_by_taxonomy(pool, spec)
            # Legacy include_otc=False drops OTC listings (XOTC).
            if request.include_otc is False:
                filtered = [s for s in filtered if (s.exchange_mic or "") != "XOTC"]
            universe_cap = max(500, requested_top * 2)
            symbols = [s.symbol for s in filtered]
            if len(symbols) > universe_cap:
                ctx.warnings.append(
                    f"Symbol pool filter matched {len(symbols)} symbols; "
                    f"capped to {universe_cap}."
                )
                symbols = symbols[:universe_cap]
            if len(symbols) < pool_size:
                ctx.warnings.append(
                    f"Taxonomy filters reduced the working list from {pool_size} "
                    f"to {len(symbols)} tickers."
                )
            # Distinguish "no match" from "data not yet enriched": when a filter
            # uses an enrichment-derived dimension, surface how many symbols were
            # excluded only because that field is still null.
            enrich_dims = [
                d
                for d in (
                    "sector",
                    "market_cap_tier",
                    "instrument_type_detail",
                    "liquidity_tier",
                )
                if getattr(spec, d)
            ]
            if enrich_dims:
                unenriched = sum(
                    1 for s in pool if any(getattr(s, d) is None for d in enrich_dims)
                )
                if unenriched:
                    ctx.warnings.append(
                        f"{unenriched} symbols lack {', '.join(enrich_dims)} data and were "
                        f"excluded; refresh pool enrichment to include them."
                    )
            if ctx.benchmark not in symbols:
                symbols.append(ctx.benchmark)
            ctx.tickers = symbols

        ctx.market_health = self._provider.get_source_health().to_dict()

        ctx.screening_tickers = [
            ticker for ticker in ctx.tickers if ticker != ctx.benchmark
        ]
        ctx.active_currencies = resolve_screening_currencies(
            request,
            strategy_currencies=ctx.universe_cfg.filt.currencies,
            tickers=ctx.screening_tickers,
            universe_id=request.universe,
        )
        if request.asof_date:
            ctx.asof_str = request.asof_date
        else:
            ctx.asof_str = resolve_default_asof_date(
                ctx.now_utc, ctx.active_currencies
            ).isoformat()

        if len(ctx.tickers) <= 1 and ctx.benchmark in ctx.tickers:
            raise NotFoundError("No tickers left after applying screener filters")

        return requested_top

    def _build_signals_and_fetch_ohlcv(
        self, ctx: _RunContext, requested_top: int
    ) -> None:
        """Build signals config, fetch and shape OHLCV, compute freshness + last-bar maps.

        Populates ctx.signals_cfg, start_date, end_date, ohlcv, last_bar_map,
        overall_last_bar, data_freshness, warnings. Raises NotFoundError on empty
        OHLCV and ServiceError on missing benchmark, exactly as before.
        """
        fields_set = ctx.request.model_fields_set

        ctx.signals_cfg = build_entry_config(ctx.strategy)
        if (
            "breakout_lookback" in fields_set
            and ctx.request.breakout_lookback is not None
        ):
            ctx.signals_cfg = replace(
                ctx.signals_cfg, breakout_lookback=ctx.request.breakout_lookback
            )
        if "pullback_ma" in fields_set and ctx.request.pullback_ma is not None:
            ctx.signals_cfg = replace(
                ctx.signals_cfg, pullback_ma=ctx.request.pullback_ma
            )
        if "min_history" in fields_set and ctx.request.min_history is not None:
            ctx.signals_cfg = replace(
                ctx.signals_cfg, min_history=ctx.request.min_history
            )

        ctx.start_date = resolve_fetch_start_date(
            ctx.asof_str, ctx.signals_cfg.min_history
        )
        ctx.end_date = ctx.asof_str
        force_refresh = bool(getattr(ctx.request, "force_refresh", False))
        sector_context_tickers = ["SPY", *sector_rotation.SECTOR_ETFS.keys()]
        sector_ohlcv = pd.DataFrame()
        try:
            sector_ohlcv = self._provider.fetch_ohlcv(
                sector_context_tickers,
                start_date=ctx.start_date,
                end_date=ctx.end_date,
                force_refresh=force_refresh,
            )
        except Exception as exc:
            logger.warning("Sector ETF OHLCV fetch failed: %s", exc)

        logger.info(
            "Screener run: universe=%s top=%s tickers=%s provider=%s",
            ctx.request.universe or "broad_market_stocks",
            requested_top,
            len(ctx.tickers),
            self._provider.get_provider_name(),
        )

        if len(ctx.tickers) > 120:
            ctx.ohlcv = _fetch_ohlcv_chunked(
                self._provider,
                ctx.tickers,
                ctx.start_date,
                ctx.end_date,
                chunk_size=100,
                force_refresh=force_refresh,
            )
        else:
            ctx.ohlcv = self._provider.fetch_ohlcv(
                ctx.tickers,
                start_date=ctx.start_date,
                end_date=ctx.end_date,
                force_refresh=force_refresh,
            )

        if ctx.ohlcv is None or ctx.ohlcv.empty:
            logger.error(
                "OHLCV fetch returned empty data (tickers=%s)", len(ctx.tickers)
            )
            raise NotFoundError("No market data found for requested tickers")

        ctx.ohlcv = merge_ohlcv(ctx.ohlcv, sector_ohlcv)

        if (
            "Close" not in ctx.ohlcv.columns.get_level_values(0)
            or ctx.benchmark not in ctx.ohlcv["Close"].columns
        ):
            logger.warning(
                "Benchmark %s missing from OHLCV; fetching separately.", ctx.benchmark
            )
            bench_df = self._provider.fetch_ohlcv(
                [ctx.benchmark],
                start_date=ctx.start_date,
                end_date=ctx.end_date,
                force_refresh=force_refresh,
            )
            ctx.ohlcv = merge_ohlcv(ctx.ohlcv, bench_df)
            if (
                "Close" not in ctx.ohlcv.columns.get_level_values(0)
                or ctx.benchmark not in ctx.ohlcv["Close"].columns
            ):
                raise ServiceError("Benchmark data missing; cannot compute momentum.")

        ctx.last_bar_map = last_bar_map(ctx.ohlcv)
        ctx.overall_last_bar = _to_iso(ctx.ohlcv.index.max())
        ctx.data_freshness = resolve_data_freshness(
            ctx.asof_str, ctx.now_utc, ctx.active_currencies
        )

        # Detect tickers that failed to download and surface them as warnings
        if "Close" in ctx.ohlcv.columns.get_level_values(0):
            present = set(ctx.ohlcv["Close"].columns.tolist())
            requested_set = set(ctx.tickers) - {ctx.benchmark}
            missing = sorted(requested_set - present)
            if missing:
                ctx.warnings.append(
                    f"{len(missing)} ticker{'s' if len(missing) != 1 else ''} could not be downloaded "
                    f"and were excluded from screening (possibly delisted or renamed): "
                    f"{', '.join(missing)}"
                )

        self._record_fetch_health(ctx)

    def _record_fetch_health(self, ctx: _RunContext) -> None:
        """Update per-symbol fetch counters; enqueue symbols that cross the threshold.

        Best-effort: a failure here never aborts the screen.
        """
        try:
            from swing_screener.data.symbol_pool import load_symbol_pool_thresholds

            _, _, threshold = load_symbol_pool_thresholds()
            present: set[str] = set()
            if (
                ctx.ohlcv is not None
                and not ctx.ohlcv.empty
                and "Close" in ctx.ohlcv.columns.get_level_values(0)
            ):
                present = set(ctx.ohlcv["Close"].columns)
            requested = list(ctx.screening_tickers)
            ok = [t for t in requested if t in present]
            failed = [t for t in requested if t not in present]
            # Guard against transient/systemic outages poisoning healthy symbols:
            # on a large-enough batch, if at least half returned no data, treat
            # it as a provider hiccup and do not increment per-symbol counters.
            # Small batches (e.g. explicit-ticker runs) keep the per-symbol signal.
            if len(requested) >= 10 and len(failed) >= len(requested) * 0.5:
                logger.warning(
                    "Skipping fetch-health increment: %d/%d tickers missing "
                    "(likely a provider outage, not per-symbol delisting).",
                    len(failed),
                    len(requested),
                )
                failed = []
            meta = {
                sym: {
                    "exchange_mic": ps.exchange_mic,
                    "sector": ps.sector,
                    "cap_tier": ps.market_cap_tier,
                    "provider": ps.primary_provider,
                }
                for sym, ps in (ctx.pool_meta or {}).items()
            }
            self._review_repo.apply_fetch_results(
                ok, failed, ctx.asof_str, threshold, meta=meta
            )
        except (
            Exception
        ) as exc:  # noqa: BLE001 - health tracking must never break a screen
            logger.warning("Fetch-health tracking failed: %s", exc)
            ctx.warnings.append("Fetch-health tracking unavailable this run.")

    def _build_run_configs(self, ctx: _RunContext, requested_top: int) -> None:
        """Apply request filter overrides and build ranking/risk/report configs.

        Mutates ctx.universe_cfg; populates ctx.ranking_cfg, risk_cfg, report_cfg;
        appends regime-scaling warnings. requested_top sizes the prefilter pool.
        """
        fields_set = ctx.request.model_fields_set

        if "min_price" in fields_set or "max_price" in fields_set:
            filt = ctx.universe_cfg.filt
            min_price = (
                ctx.request.min_price
                if ctx.request.min_price is not None
                else filt.min_price
            )
            max_price = (
                ctx.request.max_price
                if ctx.request.max_price is not None
                else filt.max_price
            )
            ctx.universe_cfg = replace(
                ctx.universe_cfg,
                filt=replace(filt, min_price=min_price, max_price=max_price),
            )
        if "currencies" in fields_set and ctx.request.currencies is not None:
            filt = ctx.universe_cfg.filt
            requested_currencies = [
                str(code).strip().upper()
                for code in ctx.request.currencies
                if str(code).strip()
            ]
            if not requested_currencies:
                requested_currencies = ["USD", "EUR"]
            ctx.universe_cfg = replace(
                ctx.universe_cfg, filt=replace(filt, currencies=requested_currencies)
            )
        if (
            "require_weekly_uptrend" in fields_set
            and ctx.request.require_weekly_uptrend is not None
        ):
            filt = ctx.universe_cfg.filt
            ctx.universe_cfg = replace(
                ctx.universe_cfg,
                filt=replace(
                    filt, require_weekly_uptrend=ctx.request.require_weekly_uptrend
                ),
            )

        ctx.ranking_cfg = build_ranking_config(ctx.strategy)
        # Rank a pool of top * prefilter_multiplier so the combined-priority
        # stage can re-rank beyond the requested top-N (stage 1 of 2).
        prefilter_pool = requested_top * ctx.combined_priority_cfg.prefilter_multiplier
        if ctx.ranking_cfg.top_n < prefilter_pool:
            ctx.ranking_cfg = replace(ctx.ranking_cfg, top_n=prefilter_pool)

        ctx.risk_cfg = build_risk_config(ctx.strategy)
        multiplier, regime_meta = compute_regime_risk_multiplier(
            ctx.ohlcv, ctx.benchmark, ctx.risk_cfg
        )
        if multiplier != 1.0:
            ctx.risk_cfg = replace(
                ctx.risk_cfg, risk_pct=ctx.risk_cfg.risk_pct * multiplier
            )
            if regime_meta.get("reasons"):
                reasons = ", ".join(regime_meta["reasons"])
                ctx.warnings.append(
                    f"Risk scaled by {multiplier:.2f}x due to regime: {reasons}"
                )
            else:
                ctx.warnings.append(
                    f"Risk scaled by {multiplier:.2f}x due to regime conditions."
                )

        ctx.report_cfg = ReportConfig(
            universe=ctx.universe_cfg,
            ranking=ctx.ranking_cfg,
            signals=ctx.signals_cfg,
            risk=ctx.risk_cfg,
        )

    def _run_daily_report(
        self, ctx: _RunContext, requested_top: int
    ) -> "pd.DataFrame | None":
        """Build sector context and run the daily report.

        Returns the ranked results DataFrame, or None when there are no
        candidates (orchestrator then returns the empty ScreenerResponse).
        Populates ctx.ticker_info and ctx.sector_rotation_by_name.
        """
        ticker_info = (
            get_multiple_ticker_info(ctx.screening_tickers)
            if ctx.screening_tickers
            else {}
        )
        etf_returns = sector_rotation.compute_sector_benchmark_returns(ctx.ohlcv)
        rotation_scores = sector_rotation.compute_sector_rotation_scores(ctx.ohlcv)
        ticker_sectors = {
            ticker: (ticker_info.get(ticker) or {}).get("sector")
            for ticker in ctx.screening_tickers
        }
        sector_benchmark_returns = sector_rotation.build_ticker_sector_returns(
            ticker_sectors,
            etf_returns,
        )
        sector_rotation_by_name = {
            sector_name: rotation_scores[etf]
            for etf, sector_name in sector_rotation.SECTOR_ETFS.items()
            if etf in rotation_scores
        }

        ctx.ticker_info = ticker_info
        ctx.sector_rotation_by_name = sector_rotation_by_name

        results = build_daily_report(
            ctx.ohlcv,
            cfg=ctx.report_cfg,
            exclude_tickers=sector_rotation.SECTOR_ETFS.keys(),
            sector_benchmark_returns=sector_benchmark_returns,
            eval_cache=self._eval_cache,
            asof_date=ctx.asof_str,
            force_refresh=bool(getattr(ctx.request, "force_refresh", False)),
        )
        try:
            self._eval_cache.prune()
        except Exception as exc:
            logger.debug("Eval cache prune failed (non-fatal): %s", exc)
        if results is None or results.empty:
            logger.warning(
                "Screener returned no candidates (top=%s, tickers=%s).",
                requested_top,
                len(ctx.tickers),
            )
            ctx.warnings.append("No candidates found for the current screener filters.")
            return None

        if not results.empty and "confidence" in results.columns:
            results = results.sort_values("confidence", ascending=False)
            if ctx.request.top:
                # Stage 1: widen prefilter to allow combined priority stage to re-rank
                prefilter_n = (
                    ctx.request.top * ctx.combined_priority_cfg.prefilter_multiplier
                )
                results = results.head(prefilter_n)
            results["rank"] = range(1, len(results) + 1)

        if len(results) < requested_top:
            message = f"Only {len(results)} candidates found for top {requested_top}."
            ctx.warnings.append(message)
            logger.warning(message)

        return results

    def _build_candidates(
        self, ctx: _RunContext, results: "pd.DataFrame"
    ) -> list[ScreenerCandidate]:
        """Construct ScreenerCandidate objects for each ranked result row.

        Reads ctx.ohlcv, ticker_info, benchmark, last_bar_map, overall_last_bar,
        market_health, risk_cfg, universe_cfg, signals_cfg, sector_rotation_by_name.
        Returns the candidate list (pre same-symbol filtering).
        """
        ohlcv = ctx.ohlcv
        ticker_info = ctx.ticker_info
        benchmark = ctx.benchmark
        last_bar_map = ctx.last_bar_map
        overall_last_bar = ctx.overall_last_bar
        market_health = ctx.market_health
        risk_cfg = ctx.risk_cfg
        universe_cfg = ctx.universe_cfg
        signals_cfg = ctx.signals_cfg
        sector_rotation_by_name = ctx.sector_rotation_by_name

        ticker_list = [str(idx) for idx in results.index]

        # Build price history only for candidate tickers to improve performance
        price_history_by_ticker = price_history_map(ohlcv, tickers=ticker_list)
        patterns_map = detect_patterns(ohlcv, tickers=ticker_list, cfg=CandleConfig())
        exec_cfg = ExecutionConfig()
        benchmark_history = price_history_map(ohlcv, tickers=[benchmark]).get(
            benchmark, []
        )
        benchmark_change_pct = price_history_change_pct(benchmark_history)
        benchmark_last_bar = last_bar_map.get(benchmark) or overall_last_bar

        atr_col = f"atr{universe_cfg.vol.atr_window}"
        ma_col = f"ma{signals_cfg.pullback_ma}_level"
        candidates = []
        for idx, row in results.iterrows():
            sma20 = safe_float(row.get(ma_col))
            sma50_dist = safe_float(row.get("dist_sma50_pct"))
            sma200_dist = safe_float(row.get("dist_sma200_pct"))
            last_price = safe_float(row.get("last"))

            sma50 = (
                last_price / (1 + sma50_dist / 100)
                if last_price and sma50_dist
                else last_price
            )
            sma200 = (
                last_price / (1 + sma200_dist / 100)
                if last_price and sma200_dist
                else last_price
            )

            ticker_str = str(idx)
            info = ticker_info.get(ticker_str, {})
            instrument = get_instrument_record(ticker_str) or {}
            last_bar = last_bar_map.get(ticker_str) or overall_last_bar
            currency = str(
                info.get("currency")
                or row.get("currency")
                or instrument.get("currency")
                or detect_currency(ticker_str)
            ).upper()

            signal = row.get("signal")
            entry_val = safe_optional_float(row.get("entry")) or last_price
            stop_val = safe_optional_float(row.get("stop"))
            if stop_val is None and entry_val:
                # No explicit stop from the pipeline — derive one from ATR so that
                # target and R:R can be computed for the order panel.
                atr_val = safe_optional_float(row.get(atr_col))
                if atr_val and atr_val > 0:
                    stop_val = round(entry_val - 2.0 * atr_val, 4)
            shares_val = safe_optional_int(row.get("shares"))
            position_size = safe_optional_float(row.get("position_value"))
            risk_usd = safe_optional_float(row.get("realized_risk"))
            risk_pct = (
                (risk_usd / risk_cfg.account_size)
                if risk_usd and risk_cfg.account_size
                else None
            )

            # Anchor the entry stop to the setup's structural invalidation when a
            # tighter pattern stop is available, so 1R reflects the real risk level
            # instead of a wide ATR multiple. Target/R:R/risk are recomputed from the
            # new stop by the risk engine below; share count is kept unchanged.
            pattern_stop_val, pattern_stop_reason = (None, None)
            if exec_cfg.pattern_stop_enabled and entry_val:
                pattern_stop_val, pattern_stop_reason = apply_pattern_stop(
                    ticker=ticker_str,
                    entry=entry_val,
                    current_stop=stop_val,
                    atr=safe_optional_float(row.get(atr_col)),
                    patterns=patterns_map,
                    buffer_atr=exec_cfg.pattern_stop_atr_buffer,
                    min_rr_stop=None,
                )
            if pattern_stop_val is not None:
                stop_val = pattern_stop_val
                position_size = None
                risk_usd = None
                risk_pct = None

            rr_target = safe_float(getattr(risk_cfg, "rr_target", 2.0), default=2.0)
            commission_pct = safe_float(
                getattr(risk_cfg, "commission_pct", 0.0), default=0.0
            )

            rec_payload = evaluate_recommendation(
                signal=str(signal) if not is_na_scalar(signal) else None,
                entry=entry_val,
                stop=stop_val,
                shares=shares_val,
                risk_cfg=risk_cfg,
                rr_target=rr_target,
                costs=RiskEngineConfig(
                    commission_pct=commission_pct,
                    slippage_bps=5.0,
                    fx_estimate_pct=0.0,
                ),
                # Pass candidate data for Trade Thesis
                ticker=ticker_str,
                strategy="Momentum",
                close=last_price,
                sma_20=sma20,
                sma_50=sma50,
                sma_200=sma200,
                atr=safe_float(row.get(atr_col)),
                momentum_6m=safe_float(row.get("mom_6m")),
                momentum_12m=safe_float(row.get("mom_12m")),
                rel_strength=safe_float(row.get("rs_6m")),
                confidence=safe_float(row.get("confidence")),
            )
            recommendation = Recommendation.model_validate(asdict(rec_payload))
            rec_risk = recommendation.risk
            candidate_history = price_history_by_ticker.get(ticker_str, [])
            symbol_change_pct = price_history_change_pct(candidate_history)
            benchmark_price_history = aligned_benchmark_price_history(
                candidate_history, benchmark_history
            )
            benchmark_outperformance_pct = (
                symbol_change_pct - benchmark_change_pct
                if symbol_change_pct is not None and benchmark_change_pct is not None
                else None
            )

            cand_patterns = [
                CandlePatternOut(
                    bar_index=p.bar_index,
                    date=p.date,
                    name=p.name,
                    direction=p.direction,
                    key_level=p.key_level,
                    context=p.context,
                    volume_ratio=p.volume_ratio,
                    bar_pressure=p.bar_pressure,
                    volume_confirmed=p.volume_confirmed,
                )
                for p in patterns_map.get(ticker_str, [])
            ]
            candidates.append(
                ScreenerCandidate(
                    ticker=ticker_str,
                    currency=currency,
                    exchange_mic=str(instrument.get("exchange_mic") or "").upper()
                    or None,
                    instrument_type=str(instrument.get("instrument_type") or "").lower()
                    or None,
                    is_otc=str(instrument.get("exchange_mic") or "").upper() == "XOTC",
                    name=info.get("name"),
                    sector=info.get("sector"),
                    last_bar=last_bar,
                    close=last_price,
                    sma_20=sma20,
                    sma_50=sma50,
                    sma_200=sma200,
                    atr=safe_float(row.get(atr_col)),
                    momentum_6m=safe_float(row.get("mom_6m")),
                    momentum_12m=safe_float(row.get("mom_12m")),
                    rel_strength=safe_float(row.get("rs_6m")),
                    sector_rs=safe_optional_float(row.get("sector_rs_6m")),
                    score=safe_float(row.get("score")),
                    confidence=safe_float(row.get("confidence")),
                    rank=int(row.get("rank", len(candidates) + 1)),
                    sma20_slope=safe_optional_float(row.get("sma20_slope")),
                    sma50_slope=safe_optional_float(row.get("sma50_slope")),
                    consolidation_tightness=safe_optional_float(
                        row.get("consolidation_tightness")
                    ),
                    close_location_in_range=safe_optional_float(
                        row.get("close_location_in_range")
                    ),
                    above_breakout_extension=safe_optional_float(
                        row.get("above_breakout_extension")
                    ),
                    breakout_volume_confirmation=(
                        bool(row.get("breakout_volume_confirmation"))
                        if not is_na_scalar(row.get("breakout_volume_confirmation"))
                        else None
                    ),
                    dist_52w_high_pct=safe_optional_float(row.get("dist_52w_high_pct")),
                    near_52w_high=(
                        bool(row.get("near_52w_high"))
                        if not is_na_scalar(row.get("near_52w_high"))
                        else None
                    ),
                    weekly_trend=(
                        str(row.get("weekly_trend"))
                        if not is_na_scalar(row.get("weekly_trend"))
                        else None
                    ),
                    volume_ratio=safe_optional_float(row.get("volume_ratio")),
                    avg_daily_volume_eur=safe_optional_float(
                        row.get("avg_daily_volume_eur")
                    ),
                    symbol_change_pct=symbol_change_pct,
                    benchmark_outperformance_pct=benchmark_outperformance_pct,
                    sector_rotation_context=sector_rotation_by_name.get(
                        info.get("sector")
                    ),
                    data_source_summary={"market_data": market_health},
                    signal=str(signal) if not is_na_scalar(signal) else None,
                    entry=rec_risk.entry,
                    stop=rec_risk.stop if stop_val is not None else None,
                    target=rec_risk.target,
                    rr=rec_risk.rr,
                    shares=shares_val if shares_val is not None else rec_risk.shares,
                    position_size_usd=(
                        position_size
                        if position_size is not None
                        else rec_risk.position_size
                    ),
                    risk_usd=risk_usd if risk_usd is not None else rec_risk.risk_amount,
                    risk_pct=risk_pct if risk_pct is not None else rec_risk.risk_pct,
                    recommendation=recommendation,
                    price_history=price_history_by_ticker.get(ticker_str, []),
                    benchmark_price_history=benchmark_price_history,
                    patterns=cand_patterns,
                    pattern_stop=pattern_stop_val,
                    pattern_stop_reason=pattern_stop_reason,
                    suggested_order_type=(
                        str(row.get("suggested_order_type"))
                        if not is_na_scalar(row.get("suggested_order_type"))
                        else None
                    ),
                    suggested_order_price=safe_optional_float(
                        row.get("suggested_order_price")
                    ),
                    execution_note=(
                        str(row.get("execution_note"))
                        if not is_na_scalar(row.get("execution_note"))
                        else None
                    ),
                )
            )

        ctx.benchmark_change_pct = benchmark_change_pct
        ctx.benchmark_last_bar = benchmark_last_bar
        return candidates

    def _apply_same_symbol_filter(
        self, ctx: _RunContext, candidates: list[ScreenerCandidate]
    ) -> tuple[list[ScreenerCandidate], int, int]:
        """Run the same-symbol re-entry evaluator over candidates.

        Returns (filtered_candidates, suppressed_count, add_on_count). Reads
        portfolio/orders services and ctx.strategy / ctx.risk_cfg.
        """
        strategy = ctx.strategy
        risk_cfg = ctx.risk_cfg

        portfolio_positions = self._portfolio_service.list_positions(
            status="open"
        ).positions
        portfolio_closed = self._portfolio_service.list_positions(
            status="closed"
        ).positions
        portfolio_orders: list = []
        if self._orders_service is not None:
            try:
                portfolio_orders = self._orders_service.list_local_orders().get(
                    "orders", []
                )
            except Exception as exc:
                logger.warning(
                    "Failed to load orders for same-symbol evaluation: %s", exc
                )
        same_symbol_evaluator = SameSymbolReentryEvaluator(self._portfolio_service)
        same_symbol_suppressed_count = 0
        same_symbol_add_on_count = 0
        filtered_candidates: list[ScreenerCandidate] = []
        manage_cfg = strategy.get("manage", {}) if isinstance(strategy, dict) else {}
        reentry_lookback = int(manage_cfg.get("reentry_lookback_days", 30))
        for candidate in candidates:
            enriched_candidate, same_symbol = same_symbol_evaluator.evaluate(
                candidate,
                positions=portfolio_positions,
                orders=portfolio_orders,
                account_size=float(risk_cfg.account_size),
                risk_pct_target=float(risk_cfg.risk_pct),
                max_position_pct=float(risk_cfg.max_position_pct),
                min_shares=int(risk_cfg.min_shares),
                closed_positions=portfolio_closed,
                reentry_lookback_days=reentry_lookback,
            )
            if same_symbol.mode in ("ADD_ON", "SCALE_BACK"):
                same_symbol_add_on_count += 1
            if same_symbol.mode == "MANAGE_ONLY":
                if enriched_candidate is None:
                    if ctx.request.include_held:
                        # Keep the held symbol so live analysis (e.g. AI) can use the
                        # full screener-grade data instead of suppressing it.
                        candidate.same_symbol = same_symbol
                        filtered_candidates.append(candidate)
                    else:
                        same_symbol_suppressed_count += 1
                    continue
                # Recommended but add-on conditions not met: show with MANAGE_ONLY flag
            if enriched_candidate is not None:
                filtered_candidates.append(enriched_candidate)

        return (
            filtered_candidates,
            same_symbol_suppressed_count,
            same_symbol_add_on_count,
        )

    def _enrich_and_rank(
        self,
        ctx: _RunContext,
        candidates: list[ScreenerCandidate],
        requested_top: int,
        same_symbol_suppressed_count: int,
    ) -> list[ScreenerCandidate]:
        """Enrich candidates (fundamentals, decision summary, earnings) and rank.

        Applies combined-priority re-rank + trim to requested_top, rebuilds
        recommendations with the decision action, applies decision-priority
        ranking, and appends suppressed + sector-concentration warnings.
        Returns the final candidate list.
        """
        asof_str = ctx.asof_str
        combined_priority_cfg = ctx.combined_priority_cfg
        risk_cfg = ctx.risk_cfg
        ticker_info = ctx.ticker_info
        warnings = ctx.warnings

        fundamentals_snapshots = load_fundamentals_snapshots(candidates)
        candidates = apply_cached_fundamentals_context(
            candidates, snapshots=fundamentals_snapshots
        )
        candidates = apply_decision_summary_context(
            candidates, snapshots=fundamentals_snapshots
        )

        finnhub_key = os.environ.get("FINNHUB_API_KEY")
        earnings_asof_date = dt.date.fromisoformat(asof_str)
        earnings_days = fetch_next_earnings_days(
            tickers=[candidate.ticker for candidate in candidates],
            finnhub_api_key=finnhub_key,
            asof_date=earnings_asof_date,
            cache_path=".cache/earnings_days.json",
        )
        candidates = [
            candidate.model_copy(
                update={"days_to_earnings": earnings_days.get(candidate.ticker)}
            )
            for candidate in candidates
        ]

        min_days_to_earnings = _min_days_to_earnings_default()
        if min_days_to_earnings > 0:
            candidates = [
                candidate
                for candidate in candidates
                if candidate.days_to_earnings is None
                or candidate.days_to_earnings >= min_days_to_earnings
            ]

        # Stage 2: combined priority re-ranks prefilter set and trims to final top-N
        candidates = compute_combined_priority(candidates, cfg=combined_priority_cfg)
        candidates = candidates[:requested_top]
        candidates = rebuild_recommendations_with_decision_action(
            candidates,
            risk_cfg=risk_cfg,
            rr_target=safe_float(getattr(risk_cfg, "rr_target", 2.0), default=2.0),
            commission_pct=safe_float(
                getattr(risk_cfg, "commission_pct", 0.0), default=0.0
            ),
        )
        candidates = apply_decision_priority_ranking(candidates)
        if same_symbol_suppressed_count > 0:
            warnings.append(
                f"{same_symbol_suppressed_count} same-symbol candidate"
                f"{'' if same_symbol_suppressed_count == 1 else 's'} suppressed because they are manage-only."
            )

        visible_ticker_list = [candidate.ticker for candidate in candidates]
        sector_map = {t: info.get("sector") for t, info in ticker_info.items()}
        warnings.extend(sector_concentration_warnings(visible_ticker_list, sector_map))

        return candidates

    def run_screener(
        self, request: ScreenerRequest, strategy_override: Optional[dict] = None
    ) -> ScreenerResponse:
        try:
            ctx = _RunContext(
                request=request,
                strategy=self._resolve_strategy(request.strategy_id, strategy_override),
                combined_priority_cfg=CombinedPriorityConfig(),
            )
            requested_top = self._resolve_universe_and_window(ctx)

            self._build_signals_and_fetch_ohlcv(ctx, requested_top)

            self._build_run_configs(ctx, requested_top)

            results = self._run_daily_report(ctx, requested_top)
            if results is None:
                return ScreenerResponse(
                    candidates=[],
                    asof_date=ctx.asof_str,
                    total_screened=len(ctx.tickers),
                    data_freshness=ctx.data_freshness,
                    warnings=ctx.warnings,
                    same_symbol_suppressed_count=0,
                    same_symbol_add_on_count=0,
                )

            candidates = self._build_candidates(ctx, results)

            candidates, same_symbol_suppressed_count, same_symbol_add_on_count = (
                self._apply_same_symbol_filter(ctx, candidates)
            )
            candidates = self._enrich_and_rank(
                ctx, candidates, requested_top, same_symbol_suppressed_count
            )

            response = ScreenerResponse(
                candidates=candidates,
                asof_date=ctx.asof_str,
                total_screened=len(ctx.tickers),
                benchmark_ticker=ctx.benchmark,
                benchmark_change_pct=ctx.benchmark_change_pct,
                benchmark_last_bar=ctx.benchmark_last_bar,
                data_freshness=ctx.data_freshness,
                warnings=ctx.warnings,
                same_symbol_suppressed_count=same_symbol_suppressed_count,
                same_symbol_add_on_count=same_symbol_add_on_count,
            )
            logger.info("Screener completed: candidates=%s", len(candidates))
            return response

        except DomainError:
            raise
        except ValueError as exc:
            logger.error("Screener configuration error: %s", exc)
            raise ValidationError(f"Invalid screener configuration: {str(exc)}")
        except (KeyError, IndexError) as exc:
            logger.error("Screener data error: %s", exc)
            raise ServiceError("Screener failed due to data error")
        except Exception:
            logger.exception("Unexpected screener error")
            raise ServiceError("Screener failed unexpectedly")

    def start_run_async(
        self, request: ScreenerRequest, on_complete=None
    ) -> ScreenerRunLaunchResponse:
        """Start screener run in background and return job metadata.

        ``on_complete`` is invoked with the ScreenerResponse after a successful
        run (e.g. to record screener history); its failures never fail the job.
        """

        def _run() -> ScreenerResponse:
            result = self.run_screener(request)
            if on_complete is not None:
                try:
                    on_complete(result)
                except Exception as exc:
                    logger.warning("Screener run on_complete hook failed: %s", exc)
            return result

        manager = get_screener_run_manager()
        job_id = manager.start_job(run_fn=_run)
        job = manager.get_job(job_id)
        if job is None:
            raise ServiceError("Failed to start screener run.")
        return ScreenerRunLaunchResponse(
            job_id=job.job_id,
            status=job.status,  # type: ignore[arg-type]
            created_at=job.created_at,
            updated_at=job.updated_at,
        )

    def get_run_status(self, job_id: str) -> ScreenerRunStatusResponse:
        """Get status for background screener run."""
        job = get_screener_run_manager().get_job(job_id)
        if job is None:
            raise NotFoundError(f"Screener run job not found: {job_id}")
        return ScreenerRunStatusResponse(
            job_id=job.job_id,
            status=job.status,  # type: ignore[arg-type]
            result=job.result,
            error=job.error,
            created_at=job.created_at,
            updated_at=job.updated_at,
        )
