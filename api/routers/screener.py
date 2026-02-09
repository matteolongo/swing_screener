"""Screener router - Run screener and preview orders."""
from __future__ import annotations

from dataclasses import replace
from typing import Optional
from fastapi import APIRouter, HTTPException
import datetime as dt
import logging
import math
import pandas as pd

from api.models import (
    ScreenerRequest,
    ScreenerResponse,
    ScreenerCandidate,
    OrderPreview,
)

from swing_screener.data.universe import (
    load_universe_from_package,
    list_package_universes,
    UniverseConfig as DataUniverseConfig,
    get_universe_benchmark,
)
from swing_screener.data.market_data import fetch_ohlcv
from swing_screener.data.ticker_info import get_multiple_ticker_info
from swing_screener.reporting.report import ReportConfig, build_daily_report
from swing_screener.reporting.concentration import sector_concentration_warnings
from swing_screener.strategy.config import (
    build_entry_config,
    build_ranking_config,
    build_risk_config,
    build_social_overlay_config,
    build_universe_config,
)
from swing_screener.risk.regime import compute_regime_risk_multiplier
from swing_screener.strategy.storage import get_active_strategy, get_strategy_by_id

router = APIRouter()
logger = logging.getLogger(__name__)


def _merge_ohlcv(base: pd.DataFrame, extra: pd.DataFrame) -> pd.DataFrame:
    if base is None or base.empty:
        return extra
    if extra is None or extra.empty:
        return base
    merged = pd.concat([base, extra], axis=1)
    merged = merged.loc[:, ~merged.columns.duplicated()]
    return merged.sort_index(axis=1)


def _fetch_ohlcv_chunked(
    tickers: list[str],
    cfg,
    chunk_size: int = 100,
) -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    for i in range(0, len(tickers), chunk_size):
        chunk = tickers[i : i + chunk_size]
        df = fetch_ohlcv(chunk, cfg=cfg, use_cache=True, force_refresh=False)
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


def _resolve_strategy(strategy_id: Optional[str]) -> dict:
    if strategy_id:
        strategy = get_strategy_by_id(strategy_id)
        if strategy is None:
            raise HTTPException(status_code=404, detail=f"Strategy not found: {strategy_id}")
        return strategy
    return get_active_strategy()


def _is_na_scalar(val) -> bool:
    """Return True if val is a scalar NA/NaN-like value (or None)."""
    if val is None:
        return True
    # Avoid ambiguous truth values for list-like objects
    if isinstance(val, (list, tuple, set, dict)):
        return False
    try:
        # pd.isna works for numpy/pandas scalar types as well as Python scalars
        return bool(pd.isna(val))
    except (TypeError, ValueError):
        # Types that pd.isna cannot handle are treated as non-NA
        return False


def _safe_float(val, default=0.0):
    """Helper to safely convert to float, replacing NaN with default."""
    if _is_na_scalar(val):
        return default
    return float(val)


def _safe_optional_float(val):
    """Helper to safely convert to optional float, replacing NaN with None."""
    if _is_na_scalar(val):
        return None
    return float(val)


def _safe_optional_int(val):
    """Helper to safely convert to optional int, replacing NaN with None."""
    if _is_na_scalar(val):
        return None
    try:
        return int(val)
    except (TypeError, ValueError, OverflowError):
        return None


def _safe_list(val):
    """Helper to safely convert various types to list of strings."""
    # Treat None and scalar NA/NaN as empty list
    if _is_na_scalar(val):
        return []
    if isinstance(val, list):
        # Filter out None/NaN elements
        return [str(v) for v in val if not _is_na_scalar(v)]
    if isinstance(val, str):
        if not val.strip():
            return []
        sep = ";" if ";" in val else "," if "," in val else None
        if sep:
            return [v.strip() for v in val.split(sep) if v.strip()]
        return [val]
    return [str(val)]


@router.get("/universes")
async def list_universes():
    """List available universe files."""
    try:
        universes = list_package_universes()
        return {"universes": universes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list universes: {e}")


@router.post("/run", response_model=ScreenerResponse)
async def run_screener(request: ScreenerRequest):
    """Run the screener on a universe of stocks."""
    try:
        requested_top = request.top or 20
        if requested_top <= 0:
            raise HTTPException(status_code=422, detail="top must be >= 1")
        warnings: list[str] = []

        fields_set = request.model_fields_set
        strategy = _resolve_strategy(request.strategy_id)
        universe_cfg = build_universe_config(strategy)
        benchmark = universe_cfg.mom.benchmark
        if request.universe:
            uni_benchmark = get_universe_benchmark(request.universe)
            if uni_benchmark and uni_benchmark != benchmark:
                universe_cfg = replace(
                    universe_cfg,
                    mom=replace(universe_cfg.mom, benchmark=uni_benchmark),
                )
                benchmark = uni_benchmark

        # Determine date
        if request.asof_date:
            asof_str = request.asof_date
        else:
            asof_str = dt.date.today().isoformat()
        
        # Determine tickers
        if request.tickers:
            tickers = [t.upper() for t in request.tickers]
            if benchmark not in tickers:
                tickers.append(benchmark)
        elif request.universe:
            universe_cap = max(500, requested_top * 2)
            ucfg = DataUniverseConfig(benchmark=benchmark, ensure_benchmark=True, max_tickers=universe_cap)
            tickers = load_universe_from_package(request.universe, ucfg)
        else:
            # Default to mega_all
            universe_cap = max(500, requested_top * 2)
            ucfg = DataUniverseConfig(benchmark=benchmark, ensure_benchmark=True, max_tickers=universe_cap)
            tickers = load_universe_from_package("mega_all", ucfg)
        
        # Import MarketDataConfig and ReportConfig
        from swing_screener.data.market_data import MarketDataConfig
        
        # Fetch market data with proper config
        cfg = MarketDataConfig(
            start="2022-01-01",
            end=asof_str,
            auto_adjust=True,
            progress=False,
        )
        logger.info(
            "Screener run: universe=%s top=%s tickers=%s",
            request.universe or "mega_all",
            requested_top,
            len(tickers),
        )

        if len(tickers) > 120:
            ohlcv = _fetch_ohlcv_chunked(tickers, cfg, chunk_size=100)
        else:
            ohlcv = fetch_ohlcv(tickers, cfg=cfg)

        if ohlcv is None or ohlcv.empty:
            logger.error("OHLCV fetch returned empty data (tickers=%s)", len(tickers))
            raise HTTPException(status_code=404, detail="No market data found for requested tickers")

        if "Close" not in ohlcv.columns.get_level_values(0) or benchmark not in ohlcv["Close"].columns:
            logger.warning("Benchmark %s missing from OHLCV; fetching separately.", benchmark)
            bench_df = fetch_ohlcv([benchmark], cfg=cfg)
            ohlcv = _merge_ohlcv(ohlcv, bench_df)
            if "Close" not in ohlcv.columns.get_level_values(0) or benchmark not in ohlcv["Close"].columns:
                raise HTTPException(status_code=500, detail="Benchmark data missing; cannot compute momentum.")

        last_bar_map = _last_bar_map(ohlcv)
        overall_last_bar = _to_iso(ohlcv.index.max())
        
        # Apply request overrides to strategy config
        if "min_price" in fields_set or "max_price" in fields_set:
            filt = universe_cfg.filt
            min_price = request.min_price if request.min_price is not None else filt.min_price
            max_price = request.max_price if request.max_price is not None else filt.max_price
            universe_cfg = replace(universe_cfg, filt=replace(filt, min_price=min_price, max_price=max_price))

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

        social_overlay_cfg = build_social_overlay_config(strategy)

        report_cfg = ReportConfig(
            universe=universe_cfg,
            ranking=ranking_cfg,
            signals=signals_cfg,
            risk=risk_cfg,
            social_overlay=social_overlay_cfg,
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
                warnings=warnings,
            )
        
        # Sort by confidence descending and take top N
        if not results.empty and "confidence" in results.columns:
            results = results.sort_values("confidence", ascending=False)
            # Take top N by confidence
            if request.top:
                results = results.head(request.top)
            # Re-rank based on confidence order
            results['rank'] = range(1, len(results) + 1)

        if len(results) < requested_top:
            message = f"Only {len(results)} candidates found for top {requested_top}."
            warnings.append(message)
            logger.warning(message)

        overlay_meta = results.attrs.get("social_overlay") if hasattr(results, "attrs") else None
        if isinstance(overlay_meta, dict) and overlay_meta.get("status") == "error":
            error_msg = overlay_meta.get("error", "provider error")
            warnings.append(f"Social overlay disabled: {error_msg}")

        # Fetch company info for all tickers
        ticker_list = [str(idx) for idx in results.index]
        ticker_info = get_multiple_ticker_info(ticker_list) if ticker_list else {}
        
        # Convert to response format
        atr_col = f"atr{universe_cfg.vol.atr_window}"
        ma_col = f"ma{signals_cfg.pullback_ma}_level"
        candidates = []
        for idx, row in results.iterrows():
            # Calculate SMAs from OHLCV if available, otherwise use distance metrics
            sma20 = _safe_float(row.get(ma_col))
            sma50_dist = _safe_float(row.get("dist_sma50_pct"))
            sma200_dist = _safe_float(row.get("dist_sma200_pct"))
            last_price = _safe_float(row.get("last"))
            
            # Approximate SMA values from distance percentages
            sma50 = last_price / (1 + sma50_dist / 100) if last_price and sma50_dist else last_price
            sma200 = last_price / (1 + sma200_dist / 100) if last_price and sma200_dist else last_price
            
            # Get company info
            ticker_str = str(idx)
            info = ticker_info.get(ticker_str, {})
            last_bar = last_bar_map.get(ticker_str) or overall_last_bar
            
            candidates.append(
                ScreenerCandidate(
                    ticker=ticker_str,
                    name=info.get('name'),
                    sector=info.get('sector'),
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
                    overlay_status=row.get("overlay_status"),
                    overlay_reasons=_safe_list(row.get("overlay_reasons")),
                    overlay_risk_multiplier=_safe_optional_float(row.get("overlay_risk_multiplier")),
                    overlay_max_pos_multiplier=_safe_optional_float(row.get("overlay_max_pos_multiplier")),
                    overlay_attention_z=_safe_optional_float(row.get("overlay_attention_z")),
                    overlay_sentiment_score=_safe_optional_float(row.get("overlay_sentiment_score")),
                    overlay_sentiment_confidence=_safe_optional_float(row.get("overlay_sentiment_confidence")),
                    overlay_hype_score=_safe_optional_float(row.get("overlay_hype_score")),
                    overlay_sample_size=_safe_optional_int(row.get("overlay_sample_size")),
                )
            )

        sector_map = {t: info.get("sector") for t, info in ticker_info.items()}
        warnings.extend(sector_concentration_warnings(ticker_list, sector_map))
        
        response = ScreenerResponse(
            candidates=candidates,
            asof_date=asof_str,
            total_screened=len(tickers),
            warnings=warnings,
        )
        logger.info("Screener completed: candidates=%s", len(candidates))
        return response
    
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Screener failed")
        raise HTTPException(status_code=500, detail=f"Screener failed: {str(e)}")


@router.post("/preview-order", response_model=OrderPreview)
async def preview_order(
    ticker: str,
    entry_price: float,
    stop_price: float,
    account_size: float = 50000,
    risk_pct: float = 0.01,
):
    """Preview order calculations (shares, position size, risk)."""
    import math
    
    try:
        if stop_price >= entry_price:
            raise HTTPException(status_code=400, detail="Stop price must be below entry price")
        
        # Calculate shares using risk formula
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
            atr=r,  # Simplified - using R as ATR proxy
            shares=shares,
            position_size_usd=position_size,
            risk_usd=actual_risk,
            risk_pct=actual_risk_pct,
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview failed: {e}")
