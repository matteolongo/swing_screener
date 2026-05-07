"""Screener service."""
from __future__ import annotations

from dataclasses import replace, asdict
from typing import Optional
import datetime as dt
import logging
import math
from zoneinfo import ZoneInfo

import pandas as pd
from fastapi import HTTPException

from api.models.screener import (
    ScreenerRequest,
    ScreenerRunLaunchResponse,
    ScreenerRunStatusResponse,
    ScreenerResponse,
    ScreenerCandidate,
    OrderPreview,
)
from api.models.recommendation import Recommendation
from api.services.portfolio_service import PortfolioService
from api.services.same_symbol_reentry import SameSymbolReentryEvaluator
from swing_screener.risk.engine import RiskEngineConfig, evaluate_recommendation
from api.repositories.strategy_repo import StrategyRepository
from swing_screener.data.universe import (
    filter_tickers_by_metadata,
    get_instrument_record,
    load_universe_from_package,
    list_package_universe_entries,
    list_package_universes,
    UniverseConfig as DataUniverseConfig,
    get_universe_benchmark,
)
from swing_screener.data.market_data import MarketDataConfig
from swing_screener.data.providers import MarketDataProvider, get_default_provider
from swing_screener.data.currency import detect_currency
from swing_screener.data.ticker_info import get_multiple_ticker_info
from swing_screener.reporting.report import ReportConfig, build_daily_report
from swing_screener.reporting.concentration import sector_concentration_warnings
from swing_screener.fundamentals.storage import FundamentalsStorage
from swing_screener.intelligence.storage import IntelligenceStorage
from swing_screener.recommendation import build_decision_summary
from swing_screener.recommendation.priority import CombinedPriorityConfig, compute_combined_priority
from swing_screener.strategy.config import (
    build_entry_config,
    build_ranking_config,
    build_risk_config,
    build_universe_config,
)
from swing_screener.risk.regime import compute_regime_risk_multiplier

# Map of removed universe ids to their replacements (or None if dropped with no replacement).
_REMOVED_UNIVERSE_IDS: dict[str, str | None] = {
    "usd_all": "broad_market_stocks",
    "mega": "broad_market_stocks",
    "mega_all": "broad_market_stocks",
    "eur_all": None,
    "usd_mega_stocks": "broad_market_stocks",
    "mega_stocks": "broad_market_stocks",
    "usd_core_etfs": "broad_market_etfs",
    "core_etfs": "broad_market_etfs",
    "usd_defense_all": "defense_stocks",
    "defense_all": "defense_stocks",
    "mega_defense": "defense_stocks",
    "usd_defense_stocks": "defense_stocks",
    "defense_stocks": "defense_stocks",
    "usd_defense_etfs": "defense_etfs",
    "defense_etfs": "defense_etfs",
    "usd_healthcare_all": "healthcare_stocks",
    "healthcare_all": "healthcare_stocks",
    "mega_healthcare_biotech": "healthcare_stocks",
    "usd_healthcare_stocks": "healthcare_stocks",
    "healthcare_stocks": "healthcare_stocks",
    "usd_healthcare_etfs": "healthcare_etfs",
    "healthcare_etfs": "healthcare_etfs",
    "eur_europe_large": "europe_large_caps",
    "europe_large": "europe_large_caps",
    "mega_europe": "europe_large_caps",
    "usd_europe_large": "global_proxy_stocks",
    "eur_amsterdam_all": "amsterdam_all",
    "eur_amsterdam_aex": "amsterdam_aex",
    "eur_amsterdam_amx": "amsterdam_amx",
    "us_all": "broad_market_stocks",
    "us_mega_stocks": "broad_market_stocks",
    "us_core_etfs": "broad_market_etfs",
    "us_defense_all": "defense_stocks",
    "us_defense_stocks": "defense_stocks",
    "us_defense_etfs": "defense_etfs",
    "us_healthcare_all": "healthcare_stocks",
    "us_healthcare_stocks": "healthcare_stocks",
    "us_healthcare_etfs": "healthcare_etfs",
    "europe_large_eur": "europe_large_caps",
    "europe_proxies_usd": "global_proxy_stocks",
}
from api.services.screener_run_manager import get_screener_run_manager

logger = logging.getLogger(__name__)
PRICE_HISTORY_MAX_BARS = 252
SUPPORTED_CURRENCIES = {"USD", "EUR"}
DECISION_ACTION_PRIORITY = {
    "BUY_NOW": 6,
    "BUY_ON_PULLBACK": 5,
    "WAIT_FOR_BREAKOUT": 4,
    "WATCH": 3,
    "TACTICAL_ONLY": 2,
    "MANAGE_ONLY": 1,
    "AVOID": 0,
}
DECISION_CONVICTION_PRIORITY = {
    "high": 2,
    "medium": 1,
    "low": 0,
}
MARKET_CLOSE_BY_CURRENCY: dict[str, tuple[str, int, int]] = {
    # (IANA timezone, close hour, close minute), with a small post-close buffer.
    "USD": ("America/New_York", 16, 10),
    "EUR": ("Europe/Amsterdam", 17, 40),
}


def _merge_ohlcv(base: pd.DataFrame, extra: pd.DataFrame) -> pd.DataFrame:
    if base is None or base.empty:
        return extra
    if extra is None or extra.empty:
        return base
    merged = pd.concat([base, extra], axis=1)
    merged = merged.loc[:, ~merged.columns.duplicated()]
    return merged.sort_index(axis=1)


def _fetch_ohlcv_chunked(
    provider: MarketDataProvider,
    tickers: list[str], 
    start_date: str,
    end_date: str,
    chunk_size: int = 100
) -> pd.DataFrame:
    """Fetch OHLCV in chunks using provider."""
    frames: list[pd.DataFrame] = []
    for i in range(0, len(tickers), chunk_size):
        chunk = tickers[i : i + chunk_size]
        df = provider.fetch_ohlcv(chunk, start_date=start_date, end_date=end_date)
        if df is None or df.empty:
            logger.warning("OHLCV chunk returned empty data (%s)", chunk)
            continue
        frames.append(df)
    if not frames:
        return pd.DataFrame()
    out = frames[0]
    for df in frames[1:]:
        out = _merge_ohlcv(out, df)
    return out


def _normalize_currency_codes(values: list[str] | tuple[str, ...] | None) -> list[str]:
    if not values:
        return []
    cleaned = []
    for value in values:
        code = str(value).strip().upper()
        if code in SUPPORTED_CURRENCIES:
            cleaned.append(code)
    return list(dict.fromkeys(cleaned))


def _previous_weekday(day: dt.date) -> dt.date:
    cursor = day - dt.timedelta(days=1)
    while cursor.weekday() >= 5:
        cursor -= dt.timedelta(days=1)
    return cursor


def _market_effective_date(currency: str, now_utc: dt.datetime) -> tuple[dt.date, bool]:
    tz_name, close_hour, close_minute = MARKET_CLOSE_BY_CURRENCY.get(
        currency,
        MARKET_CLOSE_BY_CURRENCY["USD"],
    )
    tz = ZoneInfo(tz_name)
    local_now = now_utc.astimezone(tz)
    local_date = local_now.date()

    if local_date.weekday() >= 5:
        return _previous_weekday(local_date), True

    close_local = dt.datetime.combine(
        local_date,
        dt.time(hour=close_hour, minute=close_minute),
        tzinfo=tz,
    )
    is_closed = local_now >= close_local
    if is_closed:
        return local_date, True
    return _previous_weekday(local_date), False


def _infer_currencies_from_tickers(tickers: list[str]) -> list[str]:
    inferred: list[str] = []
    for ticker in tickers:
        rec = get_instrument_record(ticker)
        if not rec:
            continue
        currency = str(rec.get("currency") or "").strip().upper()
        if currency in SUPPORTED_CURRENCIES and currency not in inferred:
            inferred.append(currency)
    return inferred


def _resolve_screening_currencies(
    request: ScreenerRequest,
    *,
    strategy_currencies: list[str] | tuple[str, ...] | None,
    tickers: list[str],
    universe_id: str | None = None,
) -> list[str]:
    requested = _normalize_currency_codes(request.currencies)
    if requested:
        return requested

    inferred = _infer_currencies_from_tickers(tickers)
    if inferred:
        return inferred

    strategy_defaults = _normalize_currency_codes(list(strategy_currencies or []))
    if strategy_defaults:
        return strategy_defaults

    if universe_id:
        from swing_screener.data.universe import get_universe_currencies
        universe_currencies = _normalize_currency_codes(get_universe_currencies(universe_id))
        if universe_currencies:
            return universe_currencies

    return ["USD", "EUR"]


def _resolve_default_asof_date(now_utc: dt.datetime, currencies: list[str]) -> dt.date:
    active = _normalize_currency_codes(currencies) or ["USD", "EUR"]
    effective_dates = [_market_effective_date(currency, now_utc)[0] for currency in active]
    return min(effective_dates)


def _all_markets_closed(now_utc: dt.datetime, currencies: list[str]) -> bool:
    active = _normalize_currency_codes(currencies) or ["USD", "EUR"]
    return all(_market_effective_date(currency, now_utc)[1] for currency in active)


def _resolve_data_freshness(asof_date: str, now_utc: dt.datetime, currencies: list[str]) -> str:
    try:
        resolved = dt.date.fromisoformat(asof_date)
    except ValueError:
        return "final_close"

    if resolved < now_utc.date():
        return "final_close"
    if resolved > now_utc.date():
        return "intraday"
    return "final_close" if _all_markets_closed(now_utc, currencies) else "intraday"


def _to_iso(ts) -> Optional[str]:
    if ts is None or pd.isna(ts):
        return None
    if isinstance(ts, pd.Timestamp):
        ts = ts.to_pydatetime()
    if isinstance(ts, dt.datetime):
        return ts.isoformat()
    if isinstance(ts, dt.date):
        return dt.datetime.combine(ts, dt.time()).isoformat()
    return str(ts)


def _to_date_iso(ts) -> Optional[str]:
    if ts is None or pd.isna(ts):
        return None
    if isinstance(ts, pd.Timestamp):
        return ts.date().isoformat()
    if isinstance(ts, dt.datetime):
        return ts.date().isoformat()
    if isinstance(ts, dt.date):
        return ts.isoformat()
    return str(ts)


def _last_bar_map(ohlcv: pd.DataFrame) -> dict[str, str]:
    out: dict[str, str] = {}
    if ohlcv is None or ohlcv.empty:
        return out
    if "Close" not in ohlcv.columns.get_level_values(0):
        return out
    close = ohlcv["Close"]
    for t in close.columns:
        series = close[t].dropna()
        if series.empty:
            continue
        ts = series.index[-1]
        iso = _to_iso(ts)
        if iso:
            out[str(t)] = iso
    return out


def _price_history_map(
    ohlcv: pd.DataFrame,
    tickers: list[str] | None = None,
    max_bars: int = PRICE_HISTORY_MAX_BARS,
) -> dict[str, list[dict]]:
    """Build price history map for specified tickers only.
    
    Args:
        ohlcv: OHLCV DataFrame with MultiIndex columns
        tickers: List of tickers to process. If None, processes all tickers.
        max_bars: Maximum number of bars to include per ticker
        
    Returns:
        Dict mapping ticker to list of {date, close} points
    """
    out: dict[str, list[dict]] = {}
    if ohlcv is None or ohlcv.empty:
        return out
    if "Close" not in ohlcv.columns.get_level_values(0):
        return out

    close = ohlcv["Close"]
    columns_to_process = close.columns if tickers is None else [t for t in tickers if t in close.columns]
    
    for ticker in columns_to_process:
        series = close[ticker].dropna()
        if series.empty:
            continue
        if max_bars > 0 and len(series) > max_bars:
            series = series.iloc[-max_bars:]
        points = []
        for ts, px in series.items():
            date = _to_date_iso(ts)
            if date is None:
                continue
            points.append({
                "date": date,
                "close": float(px),
            })
        if points:
            out[str(ticker)] = points
    return out


def _price_history_change_pct(history: list[dict]) -> Optional[float]:
    if len(history) < 2:
        return None
    try:
        start = float(history[0]["close"])
        end = float(history[-1]["close"])
    except (KeyError, TypeError, ValueError):
        return None
    if not math.isfinite(start) or not math.isfinite(end) or start <= 0:
        return None
    return ((end - start) / start) * 100.0


def _aligned_benchmark_price_history(
    candidate_history: list[dict],
    benchmark_history: list[dict],
) -> list[dict]:
    """Return benchmark closes aligned to the candidate timeline and normalized to the symbol's start price."""
    if len(candidate_history) < 2 or len(benchmark_history) < 1:
        return []

    candidate_dates: list[pd.Timestamp] = []
    candidate_closes: list[float] = []
    for point in candidate_history:
        try:
            ts = pd.Timestamp(str(point["date"]))
            close = float(point["close"])
        except (KeyError, TypeError, ValueError):
            continue
        if pd.isna(ts) or not math.isfinite(close) or close <= 0:
            continue
        candidate_dates.append(ts)
        candidate_closes.append(close)

    benchmark_points: list[tuple[pd.Timestamp, float]] = []
    for point in benchmark_history:
        try:
            ts = pd.Timestamp(str(point["date"]))
            close = float(point["close"])
        except (KeyError, TypeError, ValueError):
            continue
        if pd.isna(ts) or not math.isfinite(close) or close <= 0:
            continue
        benchmark_points.append((ts, close))

    if len(candidate_dates) < 2 or not benchmark_points:
        return []

    benchmark_series = pd.Series(
        {ts: close for ts, close in benchmark_points},
        dtype=float,
    ).sort_index()
    aligned = benchmark_series.reindex(pd.DatetimeIndex(candidate_dates)).ffill().bfill()
    if aligned.isna().any():
        return []

    symbol_start = candidate_closes[0]
    benchmark_start = float(aligned.iloc[0])
    if symbol_start <= 0 or benchmark_start <= 0:
        return []

    scale = symbol_start / benchmark_start
    return [
        {
            "date": _to_date_iso(ts) or str(ts),
            "close": float(close * scale),
        }
        for ts, close in zip(candidate_dates, aligned.tolist())
    ]


def _fundamentals_summary(snapshot) -> str | None:
    for value in getattr(snapshot, "highlights", []) or []:
        text = str(value).strip()
        if text:
            return text
    for value in getattr(snapshot, "red_flags", []) or []:
        text = str(value).strip()
        if text:
            return text
    error = getattr(snapshot, "error", None)
    if error:
        text = str(error).strip()
        if text:
            return text
    return None


def _apply_cached_fundamentals_context(
    candidates: list[ScreenerCandidate],
    *,
    storage: FundamentalsStorage | None = None,
) -> list[ScreenerCandidate]:
    if not candidates:
        return candidates
    fundamentals_storage = storage or FundamentalsStorage()
    # Load each unique ticker's snapshot once to avoid N redundant file reads.
    unique_tickers = {c.ticker for c in candidates}
    snapshot_cache: dict[str, object] = {}
    for ticker in unique_tickers:
        snap = fundamentals_storage.load_snapshot(ticker)
        if snap is not None:
            snapshot_cache[ticker] = snap
    enriched: list[ScreenerCandidate] = []
    for candidate in candidates:
        snapshot = snapshot_cache.get(candidate.ticker)
        if snapshot is None:
            enriched.append(candidate)
            continue
        enriched.append(
            candidate.model_copy(
                update={
                    "fundamentals_coverage_status": getattr(snapshot, "coverage_status", None),
                    "fundamentals_freshness_status": getattr(snapshot, "freshness_status", None),
                    "fundamentals_summary": _fundamentals_summary(snapshot),
                }
            )
        )
    return enriched


def _apply_decision_summary_context(
    candidates: list[ScreenerCandidate],
    *,
    fundamentals_storage: FundamentalsStorage | None = None,
    intelligence_storage: IntelligenceStorage | None = None,
) -> list[ScreenerCandidate]:
    if not candidates:
        return candidates

    fundamentals = fundamentals_storage or FundamentalsStorage()
    intelligence = intelligence_storage or IntelligenceStorage()

    unique_tickers = {candidate.ticker for candidate in candidates}
    snapshot_cache = {ticker: fundamentals.load_snapshot(ticker) for ticker in unique_tickers}

    opportunity_cache: dict[str, object] = {}
    latest_opportunities_date = intelligence.latest_opportunities_date()
    if latest_opportunities_date:
        for opportunity in intelligence.load_opportunities(latest_opportunities_date):
            symbol = str(getattr(opportunity, "symbol", "")).strip().upper()
            if symbol and symbol in unique_tickers:
                opportunity_cache[symbol] = opportunity

    enriched: list[ScreenerCandidate] = []
    for candidate in candidates:
        fund_snap = snapshot_cache.get(candidate.ticker)
        fund_asof = getattr(fund_snap, "asof_date", None) if fund_snap is not None else None
        enriched.append(
            candidate.model_copy(
                update={
                    "decision_summary": build_decision_summary(
                        candidate,
                        opportunity=opportunity_cache.get(candidate.ticker),
                        fundamentals=fund_snap,
                    ),
                    "fundamentals_snapshot": fund_snap,
                    "fundamentals_asof": str(fund_asof) if fund_asof else None,
                    "intelligence_asof": latest_opportunities_date,
                }
            )
        )
    return enriched


def _rebuild_recommendations_with_decision_action(
    candidates: list[ScreenerCandidate],
    *,
    risk_cfg,
    rr_target: float,
    commission_pct: float,
) -> list[ScreenerCandidate]:
    """Rebuild each candidate's recommendation using the decision_summary action as the
    signal input so that the Order tab verdict is consistent with the decision badge."""
    if not candidates:
        return candidates

    rebuilt: list[ScreenerCandidate] = []
    for candidate in candidates:
        action = getattr(getattr(candidate, "decision_summary", None), "action", None)
        if not action:
            rebuilt.append(candidate)
            continue

        rec = candidate.recommendation
        if rec is None:
            rebuilt.append(candidate)
            continue

        # Only rebuild when the original recommendation already failed signal_active.
        # This prevents demoting a RECOMMENDED candidate that already has a chart signal.
        signal_gate_passed = any(
            gate.gate_name == "signal_active" and gate.passed
            for gate in (rec.checklist or [])
        )
        if signal_gate_passed:
            rebuilt.append(candidate)
            continue

        # Rebuild using decision action as signal so signal_active reflects the full picture.
        logger.debug(
            "Rebuilding recommendation for %s: signal_active was False, decision_summary.action=%s",
            candidate.ticker,
            action,
        )
        new_rec_payload = evaluate_recommendation(
            signal=action,
            entry=rec.risk.entry if rec.risk else None,
            stop=rec.risk.stop if rec.risk else None,
            shares=rec.risk.shares if rec.risk else None,
            risk_cfg=risk_cfg,
            rr_target=rr_target,
            costs=RiskEngineConfig(
                commission_pct=commission_pct,
                slippage_bps=5.0,
                fx_estimate_pct=0.0,
            ),
            ticker=candidate.ticker,
            strategy="Momentum",
            close=candidate.close,
            sma_20=candidate.sma_20,
            sma_50=candidate.sma_50,
            sma_200=candidate.sma_200,
            atr=candidate.atr,
            momentum_6m=candidate.momentum_6m,
            momentum_12m=candidate.momentum_12m,
            rel_strength=candidate.rel_strength,
            confidence=candidate.confidence,
        )
        rebuilt.append(
            candidate.model_copy(
                update={"recommendation": Recommendation.model_validate(asdict(new_rec_payload))}
            )
        )
    return rebuilt


def _apply_decision_priority_ranking(candidates: list[ScreenerCandidate]) -> list[ScreenerCandidate]:
    if not candidates:
        return candidates

    # Keep the raw screener rank intact and use decision action + conviction as an additive ordering layer.
    ordered = sorted(
        candidates,
        key=lambda candidate: (
            -DECISION_ACTION_PRIORITY.get(
                getattr(getattr(candidate, "decision_summary", None), "action", ""),
                -1,
            ),
            -DECISION_CONVICTION_PRIORITY.get(
                getattr(getattr(candidate, "decision_summary", None), "conviction", ""),
                -1,
            ),
            candidate.rank,
            -candidate.confidence,
            candidate.ticker,
        ),
    )
    return [
        candidate.model_copy(update={"priority_rank": index})
        for index, candidate in enumerate(ordered, start=1)
    ]



def _is_na_scalar(val) -> bool:
    if val is None:
        return True
    if isinstance(val, (list, tuple, set, dict)):
        return False
    try:
        return bool(pd.isna(val))
    except (TypeError, ValueError):
        return False


def _safe_float(val, default=0.0):
    if _is_na_scalar(val):
        return default
    return float(val)


def _safe_optional_float(val):
    if _is_na_scalar(val):
        return None
    return float(val)


def _safe_optional_int(val):
    if _is_na_scalar(val):
        return None
    try:
        return int(val)
    except (TypeError, ValueError, OverflowError):
        return None


def _safe_list(val):
    if _is_na_scalar(val):
        return []
    if isinstance(val, list):
        return [str(v) for v in val if not _is_na_scalar(v)]
    if isinstance(val, str):
        if not val.strip():
            return []
        sep = ";" if ";" in val else "," if "," in val else None
        if sep:
            return [v.strip() for v in val.split(sep) if v.strip()]
        return [val]
    return [str(val)]


class ScreenerService:
    def __init__(
        self, 
        strategy_repo: StrategyRepository,
        portfolio_service: PortfolioService,
        provider: Optional[MarketDataProvider] = None
    ) -> None:
        self._strategy_repo = strategy_repo
        self._portfolio_service = portfolio_service
        self._provider = provider or get_default_provider()

    def _resolve_strategy(self, strategy_id: Optional[str], strategy_override: Optional[dict] = None) -> dict:
        if strategy_override is not None:
            return strategy_override
        if strategy_id:
            strategy = self._strategy_repo.get_strategy(strategy_id)
            if strategy is None:
                raise HTTPException(status_code=404, detail=f"Strategy not found: {strategy_id}")
            return strategy
        return self._strategy_repo.get_active_strategy()

    def list_universes(self) -> dict:
        try:
            universes = list_package_universe_entries()
            return {"universes": universes}
        except (FileNotFoundError, PermissionError) as exc:
            logger.error("Failed to access universe files: %s", exc)
            raise HTTPException(status_code=500, detail="Failed to list universes (file access error)")
        except Exception as exc:
            logger.exception("Unexpected error listing universes")
            raise HTTPException(status_code=500, detail="Failed to list universes")

    def run_screener(self, request: ScreenerRequest, strategy_override: Optional[dict] = None) -> ScreenerResponse:
        try:
            requested_top = request.top or 20
            if requested_top <= 0:
                raise HTTPException(status_code=422, detail="top must be >= 1")
            combined_priority_cfg = CombinedPriorityConfig()
            warnings: list[str] = []

            fields_set = request.model_fields_set
            strategy = self._resolve_strategy(request.strategy_id, strategy_override)
            universe_cfg = build_universe_config(strategy)
            now_utc = dt.datetime.now(dt.timezone.utc)
            benchmark = universe_cfg.mom.benchmark
            if request.universe:
                valid_ids = set(list_package_universes())
                if request.universe not in valid_ids:
                    replacement = _REMOVED_UNIVERSE_IDS.get(request.universe)
                    if replacement:
                        detail = (
                            f"Universe '{request.universe}' was removed. "
                            f"Use '{replacement}' instead."
                        )
                    else:
                        detail = (
                            f"Universe '{request.universe}' is not available. "
                            f"Available universes: {sorted(valid_ids)}"
                        )
                    raise HTTPException(status_code=422, detail=detail)
                uni_benchmark = get_universe_benchmark(request.universe)
                if uni_benchmark and uni_benchmark != benchmark:
                    universe_cfg = replace(
                        universe_cfg,
                        mom=replace(universe_cfg.mom, benchmark=uni_benchmark),
                    )
                    benchmark = uni_benchmark

            if request.tickers:
                tickers = [t.upper() for t in request.tickers]
                if benchmark not in tickers:
                    tickers.append(benchmark)
            elif request.universe:
                universe_cap = max(500, requested_top * 2)
                ucfg = DataUniverseConfig(benchmark=benchmark, ensure_benchmark=True, max_tickers=universe_cap)
                tickers = load_universe_from_package(request.universe, ucfg)
            else:
                universe_cap = max(500, requested_top * 2)
                ucfg = DataUniverseConfig(benchmark=benchmark, ensure_benchmark=True, max_tickers=universe_cap)
                tickers = load_universe_from_package("broad_market_stocks", ucfg)

            filtered_tickers = filter_tickers_by_metadata(
                tickers,
                currencies=request.currencies,
                exchange_mics=request.exchange_mics,
                include_otc=request.include_otc if request.include_otc is not None else True,
                instrument_types=request.instrument_types,
            )
            if benchmark not in filtered_tickers:
                filtered_tickers.append(benchmark)
            if len(filtered_tickers) < len(tickers):
                warnings.append(
                    f"Universe filters reduced the working list from {len(tickers)} to {len(filtered_tickers)} tickers."
                )
            tickers = filtered_tickers

            screening_tickers = [ticker for ticker in tickers if ticker != benchmark]
            active_currencies = _resolve_screening_currencies(
                request,
                strategy_currencies=universe_cfg.filt.currencies,
                tickers=screening_tickers,
                universe_id=request.universe,
            )
            if request.asof_date:
                asof_str = request.asof_date
            else:
                asof_str = _resolve_default_asof_date(now_utc, active_currencies).isoformat()

            if len(tickers) <= 1 and benchmark in tickers:
                raise HTTPException(status_code=404, detail="No tickers left after applying screener filters")

            from swing_screener.data.market_data import MarketDataConfig

            # Note: MarketDataConfig is kept for backward compatibility
            # but not passed to provider (provider has its own defaults)
            start_date = "2022-01-01"
            end_date = asof_str
            
            logger.info(
                "Screener run: universe=%s top=%s tickers=%s provider=%s",
                request.universe or "broad_market_stocks",
                requested_top,
                len(tickers),
                self._provider.get_provider_name(),
            )

            if len(tickers) > 120:
                ohlcv = _fetch_ohlcv_chunked(self._provider, tickers, start_date, end_date, chunk_size=100)
            else:
                ohlcv = self._provider.fetch_ohlcv(tickers, start_date=start_date, end_date=end_date)

            if ohlcv is None or ohlcv.empty:
                logger.error("OHLCV fetch returned empty data (tickers=%s)", len(tickers))
                raise HTTPException(status_code=404, detail="No market data found for requested tickers")

            if "Close" not in ohlcv.columns.get_level_values(0) or benchmark not in ohlcv["Close"].columns:
                logger.warning("Benchmark %s missing from OHLCV; fetching separately.", benchmark)
                bench_df = self._provider.fetch_ohlcv([benchmark], start_date=start_date, end_date=end_date)
                ohlcv = _merge_ohlcv(ohlcv, bench_df)
                if "Close" not in ohlcv.columns.get_level_values(0) or benchmark not in ohlcv["Close"].columns:
                    raise HTTPException(status_code=500, detail="Benchmark data missing; cannot compute momentum.")

            last_bar_map = _last_bar_map(ohlcv)
            overall_last_bar = _to_iso(ohlcv.index.max())
            data_freshness = _resolve_data_freshness(asof_str, now_utc, active_currencies)

            # Detect tickers that failed to download and surface them as warnings
            if "Close" in ohlcv.columns.get_level_values(0):
                present = set(ohlcv["Close"].columns.tolist())
                requested_set = set(tickers) - {benchmark}
                missing = sorted(requested_set - present)
                if missing:
                    warnings.append(
                        f"{len(missing)} ticker{'s' if len(missing) != 1 else ''} could not be downloaded "
                        f"and were excluded from screening (possibly delisted or renamed): "
                        f"{', '.join(missing)}"
                    )

            if "min_price" in fields_set or "max_price" in fields_set:
                filt = universe_cfg.filt
                min_price = request.min_price if request.min_price is not None else filt.min_price
                max_price = request.max_price if request.max_price is not None else filt.max_price
                universe_cfg = replace(universe_cfg, filt=replace(filt, min_price=min_price, max_price=max_price))
            if "currencies" in fields_set and request.currencies is not None:
                filt = universe_cfg.filt
                requested_currencies = [
                    str(code).strip().upper()
                    for code in request.currencies
                    if str(code).strip()
                ]
                if not requested_currencies:
                    requested_currencies = ["USD", "EUR"]
                universe_cfg = replace(universe_cfg, filt=replace(filt, currencies=requested_currencies))

            ranking_cfg = build_ranking_config(strategy)
            if ranking_cfg.top_n < requested_top:
                ranking_cfg = replace(ranking_cfg, top_n=requested_top)

            signals_cfg = build_entry_config(strategy)
            if "breakout_lookback" in fields_set and request.breakout_lookback is not None:
                signals_cfg = replace(signals_cfg, breakout_lookback=request.breakout_lookback)
            if "pullback_ma" in fields_set and request.pullback_ma is not None:
                signals_cfg = replace(signals_cfg, pullback_ma=request.pullback_ma)
            if "min_history" in fields_set and request.min_history is not None:
                signals_cfg = replace(signals_cfg, min_history=request.min_history)

            risk_cfg = build_risk_config(strategy)
            multiplier, regime_meta = compute_regime_risk_multiplier(ohlcv, benchmark, risk_cfg)
            if multiplier != 1.0:
                risk_cfg = replace(risk_cfg, risk_pct=risk_cfg.risk_pct * multiplier)
                if regime_meta.get("reasons"):
                    reasons = ", ".join(regime_meta["reasons"])
                    warnings.append(f"Risk scaled by {multiplier:.2f}x due to regime: {reasons}")
                else:
                    warnings.append(f"Risk scaled by {multiplier:.2f}x due to regime conditions.")

            report_cfg = ReportConfig(
                universe=universe_cfg,
                ranking=ranking_cfg,
                signals=signals_cfg,
                risk=risk_cfg,
            )

            results = build_daily_report(ohlcv, cfg=report_cfg, exclude_tickers=[])
            if results is None or results.empty:
                logger.warning(
                    "Screener returned no candidates (top=%s, tickers=%s).",
                    requested_top,
                    len(tickers),
                )
                warnings.append("No candidates found for the current screener filters.")
                return ScreenerResponse(
                    candidates=[],
                    asof_date=asof_str,
                    total_screened=len(tickers),
                    data_freshness=data_freshness,
                    warnings=warnings,
                    same_symbol_suppressed_count=0,
                    same_symbol_add_on_count=0,
                )

            if not results.empty and "confidence" in results.columns:
                results = results.sort_values("confidence", ascending=False)
                if request.top:
                    # Stage 1: widen prefilter to allow combined priority stage to re-rank
                    prefilter_n = request.top * combined_priority_cfg.prefilter_multiplier
                    results = results.head(prefilter_n)
                results["rank"] = range(1, len(results) + 1)

            if len(results) < requested_top:
                message = f"Only {len(results)} candidates found for top {requested_top}."
                warnings.append(message)
                logger.warning(message)

            ticker_list = [str(idx) for idx in results.index]
            ticker_info = get_multiple_ticker_info(ticker_list) if ticker_list else {}
            
            # Build price history only for candidate tickers to improve performance
            price_history_map = _price_history_map(ohlcv, tickers=ticker_list)
            benchmark_history = _price_history_map(ohlcv, tickers=[benchmark]).get(benchmark, [])
            benchmark_change_pct = _price_history_change_pct(benchmark_history)
            benchmark_last_bar = last_bar_map.get(benchmark) or overall_last_bar

            atr_col = f"atr{universe_cfg.vol.atr_window}"
            ma_col = f"ma{signals_cfg.pullback_ma}_level"
            candidates = []
            for idx, row in results.iterrows():
                sma20 = _safe_float(row.get(ma_col))
                sma50_dist = _safe_float(row.get("dist_sma50_pct"))
                sma200_dist = _safe_float(row.get("dist_sma200_pct"))
                last_price = _safe_float(row.get("last"))

                sma50 = last_price / (1 + sma50_dist / 100) if last_price and sma50_dist else last_price
                sma200 = last_price / (1 + sma200_dist / 100) if last_price and sma200_dist else last_price

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
                entry_val = _safe_optional_float(row.get("entry")) or last_price
                stop_val = _safe_optional_float(row.get("stop"))
                if stop_val is None and entry_val:
                    # No explicit stop from the pipeline — derive one from ATR so that
                    # target and R:R can be computed for the order panel.
                    atr_val = _safe_optional_float(row.get(atr_col))
                    if atr_val and atr_val > 0:
                        stop_val = round(entry_val - 2.0 * atr_val, 4)
                shares_val = _safe_optional_int(row.get("shares"))
                position_size = _safe_optional_float(row.get("position_value"))
                risk_usd = _safe_optional_float(row.get("realized_risk"))
                risk_pct = (risk_usd / risk_cfg.account_size) if risk_usd and risk_cfg.account_size else None

                rr_target = _safe_float(getattr(risk_cfg, "rr_target", 2.0), default=2.0)
                commission_pct = _safe_float(getattr(risk_cfg, "commission_pct", 0.0), default=0.0)

                rec_payload = evaluate_recommendation(
                    signal=str(signal) if not _is_na_scalar(signal) else None,
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
                    atr=_safe_float(row.get(atr_col)),
                    momentum_6m=_safe_float(row.get("mom_6m")),
                        momentum_12m=_safe_float(row.get("mom_12m")),
                        rel_strength=_safe_float(row.get("rs_6m")),
                        confidence=_safe_float(row.get("confidence")),
                )
                recommendation = Recommendation.model_validate(asdict(rec_payload))
                rec_risk = recommendation.risk
                candidate_history = price_history_map.get(ticker_str, [])
                symbol_change_pct = _price_history_change_pct(candidate_history)
                benchmark_price_history = _aligned_benchmark_price_history(candidate_history, benchmark_history)
                benchmark_outperformance_pct = (
                    symbol_change_pct - benchmark_change_pct
                    if symbol_change_pct is not None and benchmark_change_pct is not None
                    else None
                )

                candidates.append(
                    ScreenerCandidate(
                        ticker=ticker_str,
                        currency=currency,
                        exchange_mic=str(instrument.get("exchange_mic") or "").upper() or None,
                        instrument_type=str(instrument.get("instrument_type") or "").lower() or None,
                        is_otc=str(instrument.get("exchange_mic") or "").upper() == "XOTC",
                        name=info.get("name"),
                        sector=info.get("sector"),
                        last_bar=last_bar,
                        close=last_price,
                        sma_20=sma20,
                        sma_50=sma50,
                        sma_200=sma200,
                        atr=_safe_float(row.get(atr_col)),
                        momentum_6m=_safe_float(row.get("mom_6m")),
                        momentum_12m=_safe_float(row.get("mom_12m")),
                        rel_strength=_safe_float(row.get("rs_6m")),
                        score=_safe_float(row.get("score")),
                        confidence=_safe_float(row.get("confidence")),
                        rank=int(row.get("rank", len(candidates) + 1)),
                        sma20_slope=_safe_optional_float(row.get("sma20_slope")),
                        sma50_slope=_safe_optional_float(row.get("sma50_slope")),
                        consolidation_tightness=_safe_optional_float(row.get("consolidation_tightness")),
                        close_location_in_range=_safe_optional_float(row.get("close_location_in_range")),
                        above_breakout_extension=_safe_optional_float(row.get("above_breakout_extension")),
                        breakout_volume_confirmation=(
                            bool(row.get("breakout_volume_confirmation"))
                            if not _is_na_scalar(row.get("breakout_volume_confirmation"))
                            else None
                        ),
                        volume_ratio=_safe_optional_float(row.get("volume_ratio")),
                        avg_daily_volume_eur=_safe_optional_float(row.get("avg_daily_volume_eur")),
                        symbol_change_pct=symbol_change_pct,
                        benchmark_outperformance_pct=benchmark_outperformance_pct,
                        signal=str(signal) if not _is_na_scalar(signal) else None,
                        entry=rec_risk.entry,
                        stop=rec_risk.stop if stop_val is not None else None,
                        target=rec_risk.target,
                        rr=rec_risk.rr,
                        shares=shares_val if shares_val is not None else rec_risk.shares,
                        position_size_usd=position_size if position_size is not None else rec_risk.position_size,
                        risk_usd=risk_usd if risk_usd is not None else rec_risk.risk_amount,
                        risk_pct=risk_pct if risk_pct is not None else rec_risk.risk_pct,
                        recommendation=recommendation,
                        price_history=price_history_map.get(ticker_str, []),
                        benchmark_price_history=benchmark_price_history,
                        suggested_order_type=(
                            str(row.get("suggested_order_type"))
                            if not _is_na_scalar(row.get("suggested_order_type"))
                            else None
                        ),
                        suggested_order_price=_safe_optional_float(row.get("suggested_order_price")),
                        execution_note=(
                            str(row.get("execution_note"))
                            if not _is_na_scalar(row.get("execution_note"))
                            else None
                        ),
                    )
                )

            portfolio_positions = self._portfolio_service.list_positions(status="open").positions
            portfolio_orders: list = []
            same_symbol_evaluator = SameSymbolReentryEvaluator(self._portfolio_service)
            same_symbol_suppressed_count = 0
            same_symbol_add_on_count = 0
            filtered_candidates: list[ScreenerCandidate] = []
            for candidate in candidates:
                enriched_candidate, same_symbol = same_symbol_evaluator.evaluate(
                    candidate,
                    positions=portfolio_positions,
                    orders=portfolio_orders,
                    account_size=float(risk_cfg.account_size),
                    risk_pct_target=float(risk_cfg.risk_pct),
                    max_position_pct=float(risk_cfg.max_position_pct),
                    min_shares=int(risk_cfg.min_shares),
                )
                if same_symbol.mode == "ADD_ON":
                    same_symbol_add_on_count += 1
                if same_symbol.mode == "MANAGE_ONLY":
                    if enriched_candidate is None:
                        same_symbol_suppressed_count += 1
                        continue
                    # Recommended but add-on conditions not met: show with MANAGE_ONLY flag
                if enriched_candidate is not None:
                    filtered_candidates.append(enriched_candidate)

            candidates = filtered_candidates
            candidates = _apply_cached_fundamentals_context(candidates)
            candidates = _apply_decision_summary_context(candidates)
            # Stage 2: combined priority re-ranks prefilter set and trims to final top-N
            candidates = compute_combined_priority(candidates, cfg=combined_priority_cfg)
            candidates = candidates[:requested_top]
            candidates = _rebuild_recommendations_with_decision_action(
                candidates,
                risk_cfg=risk_cfg,
                rr_target=_safe_float(getattr(risk_cfg, "rr_target", 2.0), default=2.0),
                commission_pct=_safe_float(getattr(risk_cfg, "commission_pct", 0.0), default=0.0),
            )
            candidates = _apply_decision_priority_ranking(candidates)
            if same_symbol_suppressed_count > 0:
                warnings.append(
                    f"{same_symbol_suppressed_count} same-symbol candidate"
                    f"{'' if same_symbol_suppressed_count == 1 else 's'} suppressed because they are manage-only."
                )

            visible_ticker_list = [candidate.ticker for candidate in candidates]
            sector_map = {t: info.get("sector") for t, info in ticker_info.items()}
            warnings.extend(sector_concentration_warnings(visible_ticker_list, sector_map))

            response = ScreenerResponse(
                candidates=candidates,
                asof_date=asof_str,
                total_screened=len(tickers),
                benchmark_ticker=benchmark,
                benchmark_change_pct=benchmark_change_pct,
                benchmark_last_bar=benchmark_last_bar,
                data_freshness=data_freshness,
                warnings=warnings,
                same_symbol_suppressed_count=same_symbol_suppressed_count,
                same_symbol_add_on_count=same_symbol_add_on_count,
            )
            logger.info("Screener completed: candidates=%s", len(candidates))
            return response

        except HTTPException:
            raise
        except ValueError as exc:
            logger.error("Screener configuration error: %s", exc)
            raise HTTPException(status_code=400, detail=f"Invalid screener configuration: {str(exc)}")
        except (KeyError, IndexError) as exc:
            logger.error("Screener data error: %s", exc)
            raise HTTPException(status_code=500, detail="Screener failed due to data error")
        except Exception as exc:
            logger.exception("Unexpected screener error")
            raise HTTPException(status_code=500, detail="Screener failed unexpectedly")

    def start_run_async(self, request: ScreenerRequest) -> ScreenerRunLaunchResponse:
        """Start screener run in background and return job metadata."""
        manager = get_screener_run_manager()
        job_id = manager.start_job(run_fn=lambda: self.run_screener(request))
        job = manager.get_job(job_id)
        if job is None:
            raise HTTPException(status_code=500, detail="Failed to start screener run.")
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
            raise HTTPException(status_code=404, detail=f"Screener run job not found: {job_id}")
        return ScreenerRunStatusResponse(
            job_id=job.job_id,
            status=job.status,  # type: ignore[arg-type]
            result=job.result,
            error=job.error,
            created_at=job.created_at,
            updated_at=job.updated_at,
        )

    def preview_order(
        self,
        ticker: str,
        entry_price: float,
        stop_price: float,
        account_size: float = 50000,
        risk_pct: float = 0.01,
    ) -> OrderPreview:
        try:
            if stop_price >= entry_price:
                raise HTTPException(status_code=400, detail="Stop price must be below entry price")

            r = entry_price - stop_price
            risk_dollars = account_size * risk_pct
            shares = max(1, math.floor(risk_dollars / r))

            position_size = shares * entry_price
            actual_risk = shares * r
            actual_risk_pct = actual_risk / account_size

            return OrderPreview(
                ticker=ticker.upper(),
                entry_price=entry_price,
                stop_price=stop_price,
                atr=r,
                shares=shares,
                position_size_usd=position_size,
                risk_usd=actual_risk,
                risk_pct=actual_risk_pct,
            )

        except HTTPException:
            raise
        except ValueError as exc:
            logger.error("Preview configuration error: %s", exc)
            raise HTTPException(status_code=400, detail=f"Invalid preview request: {str(exc)}")
        except Exception as exc:
            logger.exception("Unexpected preview error")
            raise HTTPException(status_code=500, detail="Preview failed unexpectedly")
