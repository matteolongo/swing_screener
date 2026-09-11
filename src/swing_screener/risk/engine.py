from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import Optional

from swing_screener.risk.recommendations.engine import (
    RecommendationPayload,
    build_recommendation,
    resolve_target,
)
from swing_screener.risk.recommendations.thesis import (
    build_trade_thesis,
    thesis_to_dict,
)
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
    risk_cfg: RiskConfig,
    rr_target: float,
    target: Optional[float] = None,
    target_source: str = "risk_multiple",
    data_status: str = "current",
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
    currency: Optional[str] = None,
    account_currency: Optional[str] = None,
    account_to_quote_rate: Optional[float] = None,
) -> RecommendationPayload:
    """
    Evaluate recommendation with optional Trade Thesis generation.

    If candidate data is provided, generates a complete Trade Thesis.
    Otherwise, falls back to basic recommendation without thesis.
    """
    thesis_dict = None
    thesis_stop = None
    if (
        entry is not None
        and stop is not None
        and math.isfinite(entry)
        and math.isfinite(stop)
        and entry > 0
        and stop > 0
        and entry > stop
    ):
        thesis_stop = stop

    # Build Trade Thesis if we have the required data
    if all(
        [
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
        ]
    ):
        try:
            # Thesis RR uses the same canonical target validity as the plan:
            # only a valid independently sourced target produces a validated RR.
            # The advisory desired_target must never make the thesis look
            # actionable, so fall back to 0.0 (no validated RR) instead.
            _, thesis_rr, thesis_target_is_independent = resolve_target(
                entry=entry,
                stop=thesis_stop,
                target=target,
                target_source=target_source,
            )
            rr = (
                thesis_rr
                if thesis_target_is_independent and thesis_rr is not None
                else 0.0
            )

            thesis = build_trade_thesis(
                ticker=ticker,
                strategy=strategy,
                signal=signal,
                entry=entry,
                stop=thesis_stop,
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
        target=target,
        target_source=target_source,
        data_status=data_status,
        min_rr=risk_cfg.min_rr,
        max_fee_risk_pct=risk_cfg.max_fee_risk_pct,
        commission_pct=costs.commission_pct,
        slippage_bps=costs.slippage_bps,
        fx_estimate_pct=costs.fx_estimate_pct,
        min_shares=risk_cfg.min_shares,
        max_position_pct=risk_cfg.max_position_pct,
        currency=currency,
        account_currency=account_currency,
        account_to_quote_rate=account_to_quote_rate,
        thesis=thesis_dict,
    )
