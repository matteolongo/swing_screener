from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from swing_screener.recommendations.engine import RecommendationPayload, build_recommendation
from swing_screener.risk.position_sizing import RiskConfig


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
) -> RecommendationPayload:
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
    )

