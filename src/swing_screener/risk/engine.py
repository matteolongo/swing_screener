from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from swing_screener.recommendations.engine import RecommendationPayload, build_recommendation
from swing_screener.recommendations.thesis import build_trade_thesis, thesis_to_dict
from swing_screener.risk.position_sizing import RiskConfig

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RiskEngineConfig:
    commission_pct: float = 0.0
    slippage_bps: float = 5.0
    fx_estimate_pct: float = 0.0


def evaluate_recommendation(
    *,
    signal: Optional[str],
    entry: Optional[float],
    stop: Optional[float],
    shares: Optional[int],
    overlay_status: Optional[str],
    risk_cfg: RiskConfig,
    rr_target: float,
    costs: RiskEngineConfig = RiskEngineConfig(),
    # Optional candidate data for Trade Thesis
    ticker: Optional[str] = None,
    strategy: str = "Momentum",
    close: Optional[float] = None,
    sma_20: Optional[float] = None,
    sma_50: Optional[float] = None,
    sma_200: Optional[float] = None,
    atr: Optional[float] = None,
    momentum_6m: Optional[float] = None,
    momentum_12m: Optional[float] = None,
    rel_strength: Optional[float] = None,
    confidence: Optional[float] = None,
) -> RecommendationPayload:
    """
    Evaluate recommendation with optional Trade Thesis generation.
    
    If candidate data is provided, generates a complete Trade Thesis.
    Otherwise, falls back to basic recommendation without thesis.
    """
    thesis_dict = None
    
    # Build Trade Thesis if we have the required data
    if all([
        ticker is not None,
        close is not None,
        sma_20 is not None,
        sma_50 is not None,
        sma_200 is not None,
        atr is not None,
        momentum_6m is not None,
        momentum_12m is not None,
        rel_strength is not None,
        confidence is not None,
    ]):
        try:
            # Calculate RR for thesis (will be recalculated in build_recommendation)
            rr = 0.0
            if stop is not None and entry is not None and entry > stop:
                risk_per_share = entry - stop
                target = entry + (rr_target * risk_per_share)
                rr = (target - entry) / risk_per_share
            
            thesis = build_trade_thesis(
                ticker=ticker,
                strategy=strategy,
                signal=signal,
                entry=entry,
                stop=stop,
                rr=rr,
                close=close,
                sma_20=sma_20,
                sma_50=sma_50,
                sma_200=sma_200,
                atr=atr,
                momentum_6m=momentum_6m,
                momentum_12m=momentum_12m,
                rel_strength=rel_strength,
                confidence=confidence,
            )
            thesis_dict = thesis_to_dict(thesis)
        except Exception as e:
            # If thesis building fails, continue without it
            # This is expected when optional data (like SMA values) is unavailable
            logger.debug(f"Could not build trade thesis for {ticker}: {e}")
            thesis_dict = None
    
    return build_recommendation(
        signal=signal,
        entry=entry,
        stop=stop,
        shares=shares,
        account_size=risk_cfg.account_size,
        risk_pct_target=risk_cfg.risk_pct,
        rr_target=rr_target,
        min_rr=risk_cfg.min_rr,
        max_fee_risk_pct=risk_cfg.max_fee_risk_pct,
        commission_pct=costs.commission_pct,
        slippage_bps=costs.slippage_bps,
        fx_estimate_pct=costs.fx_estimate_pct,
        overlay_status=overlay_status,
        min_shares=risk_cfg.min_shares,
        thesis=thesis_dict,
    )

