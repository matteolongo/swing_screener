"""Screener service."""
from __future__ import annotations

from dataclasses import replace, asdict
from typing import Optional
import datetime as dt
import logging
import math

import pandas as pd
from fastapi import HTTPException

from api.models.screener import (
    ScreenerRequest,
    ScreenerResponse,
    ScreenerCandidate,
    OrderPreview,
)
from api.models.recommendation import Recommendation
from swing_screener.risk.engine import RiskEngineConfig, evaluate_recommendation
from api.repositories.strategy_repo import StrategyRepository
from swing_screener.data.universe import (
    load_universe_from_package,
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
from swing_screener.strategy.config import (
    build_entry_config,
    build_ranking_config,
    build_risk_config,
    build_social_overlay_config,
    build_universe_config,
)
from swing_screener.risk.regime import compute_regime_risk_multiplier
from api.services.social_warmup import get_social_warmup_manager

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
        provider: Optional[MarketDataProvider] = None
    ) -> None:
        self._strategy_repo = strategy_repo
        self._provider = provider or get_default_provider()

    def _resolve_strategy(self, strategy_id: Optional[str]) -> dict:
        if strategy_id:
            strategy = self._strategy_repo.get_strategy(strategy_id)
            if strategy is None:
                raise HTTPException(status_code=404, detail=f"Strategy not found: {strategy_id}")
            return strategy
        return self._strategy_repo.get_active_strategy()

    def list_universes(self) -> dict:
        try:
            universes = list_package_universes()
            return {"universes": universes}
        except (FileNotFoundError, PermissionError) as exc:
            logger.error("Failed to access universe files: %s", exc)
            raise HTTPException(status_code=500, detail="Failed to list universes (file access error)")
        except Exception as exc:
            logger.exception("Unexpected error listing universes")
            raise HTTPException(status_code=500, detail="Failed to list universes")

    def run_screener(self, request: ScreenerRequest) -> ScreenerResponse:
        try:
            requested_top = request.top or 20
            if requested_top <= 0:
                raise HTTPException(status_code=422, detail="top must be >= 1")
            warnings: list[str] = []

            fields_set = request.model_fields_set
            strategy = self._resolve_strategy(request.strategy_id)
            backtest_cfg = strategy.get("backtest", {}) if isinstance(strategy, dict) else {}
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

            if request.asof_date:
                asof_str = request.asof_date
            else:
                asof_str = dt.date.today().isoformat()

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
                tickers = load_universe_from_package("mega_all", ucfg)

            from swing_screener.data.market_data import MarketDataConfig

            # Note: MarketDataConfig is kept for backward compatibility
            # but not passed to provider (provider has its own defaults)
            start_date = "2022-01-01"
            end_date = asof_str
            
            logger.info(
                "Screener run: universe=%s top=%s tickers=%s provider=%s",
                request.universe or "mega_all",
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

            social_overlay_cfg = build_social_overlay_config(strategy)
            report_social_overlay_cfg = social_overlay_cfg
            if social_overlay_cfg.enabled:
                # Run social analysis out-of-band to avoid blocking screener completion.
                report_social_overlay_cfg = replace(social_overlay_cfg, enabled=False)

            report_cfg = ReportConfig(
                universe=universe_cfg,
                ranking=ranking_cfg,
                signals=signals_cfg,
                risk=risk_cfg,
                social_overlay=report_social_overlay_cfg,
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

            if not results.empty and "confidence" in results.columns:
                results = results.sort_values("confidence", ascending=False)
                if request.top:
                    results = results.head(request.top)
                results["rank"] = range(1, len(results) + 1)

            if len(results) < requested_top:
                message = f"Only {len(results)} candidates found for top {requested_top}."
                warnings.append(message)
                logger.warning(message)

            overlay_meta = results.attrs.get("social_overlay") if hasattr(results, "attrs") else None
            if isinstance(overlay_meta, dict) and overlay_meta.get("status") == "error":
                error_msg = overlay_meta.get("error", "provider error")
                warnings.append(f"Social overlay disabled: {error_msg}")

            ticker_list = [str(idx) for idx in results.index]
            ticker_info = get_multiple_ticker_info(ticker_list) if ticker_list else {}

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
                last_bar = last_bar_map.get(ticker_str) or overall_last_bar
                currency = str(
                    info.get("currency")
                    or row.get("currency")
                    or detect_currency(ticker_str)
                ).upper()
                if currency not in {"USD", "EUR"}:
                    currency = detect_currency(ticker_str)

                signal = row.get("signal")
                entry_val = _safe_optional_float(row.get("entry")) or last_price
                stop_val = _safe_optional_float(row.get("stop"))
                shares_val = _safe_optional_int(row.get("shares"))
                position_size = _safe_optional_float(row.get("position_value"))
                risk_usd = _safe_optional_float(row.get("realized_risk"))
                risk_pct = (risk_usd / risk_cfg.account_size) if risk_usd and risk_cfg.account_size else None
                overlay_status = (
                    str(row.get("overlay_status"))
                    if not _is_na_scalar(row.get("overlay_status"))
                    else ("PENDING" if social_overlay_cfg.enabled else None)
                )
                overlay_reasons = _safe_list(row.get("overlay_reasons"))
                if social_overlay_cfg.enabled and not overlay_reasons:
                    overlay_reasons = ["BACKGROUND_WARMUP"]

                take_profit_r = _safe_float(backtest_cfg.get("take_profit_r", 2.0), default=2.0)
                commission_pct = _safe_float(backtest_cfg.get("commission_pct", 0.0), default=0.0)

                rec_payload = evaluate_recommendation(
                    signal=str(signal) if not _is_na_scalar(signal) else None,
                    entry=entry_val,
                    stop=stop_val,
                    shares=shares_val,
                    overlay_status=overlay_status,
                    risk_cfg=risk_cfg,
                    rr_target=take_profit_r,
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

                candidates.append(
                    ScreenerCandidate(
                        ticker=ticker_str,
                        currency=currency,
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
                        overlay_status=overlay_status,
                        overlay_reasons=overlay_reasons,
                        overlay_risk_multiplier=_safe_optional_float(row.get("overlay_risk_multiplier")),
                        overlay_max_pos_multiplier=_safe_optional_float(row.get("overlay_max_pos_multiplier")),
                        overlay_attention_z=_safe_optional_float(row.get("overlay_attention_z")),
                        overlay_sentiment_score=_safe_optional_float(row.get("overlay_sentiment_score")),
                        overlay_sentiment_confidence=_safe_optional_float(row.get("overlay_sentiment_confidence")),
                        overlay_hype_score=_safe_optional_float(row.get("overlay_hype_score")),
                        overlay_sample_size=_safe_optional_int(row.get("overlay_sample_size")),
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
                    )
                )

            sector_map = {t: info.get("sector") for t, info in ticker_info.items()}
            warnings.extend(sector_concentration_warnings(ticker_list, sector_map))
            social_warmup_job_id: Optional[str] = None
            if social_overlay_cfg.enabled and ticker_list:
                try:
                    social_warmup_job_id = get_social_warmup_manager().start_job(
                        symbols=ticker_list,
                        lookback_hours=social_overlay_cfg.lookback_hours,
                        min_sample_size=social_overlay_cfg.min_sample_size,
                        providers=list(social_overlay_cfg.providers),
                        sentiment_analyzer=social_overlay_cfg.sentiment_analyzer,
                    )
                except Exception as exc:
                    logger.warning("Failed to start social warmup job: %s", exc)

            response = ScreenerResponse(
                candidates=candidates,
                asof_date=asof_str,
                total_screened=len(tickers),
                warnings=warnings,
                social_warmup_job_id=social_warmup_job_id,
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
