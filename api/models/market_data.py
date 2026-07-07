"""Response models for market-data volume-zone analysis."""

from __future__ import annotations

from pydantic import BaseModel, Field

from swing_screener.analysis.volume_zones import VolumeZoneAnalysis


class DataQualityOut(BaseModel):
    ok: bool
    bars: int
    warnings: list[str] = Field(default_factory=list)


class KeyLevelsOut(BaseModel):
    price: float | None = None
    poc: float | None = None
    vwap: float | None = None
    sma20: float | None = None
    sma50: float | None = None
    sma200: float | None = None
    atr14: float | None = None
    swing_high: float | None = None
    swing_low: float | None = None
    rel_volume: float | None = None


class VolumeZoneOut(BaseModel):
    kind: str
    role: str
    price_low: float
    price_high: float
    center: float
    volume_share: float


class TradePlanOut(BaseModel):
    direction: str
    entry: float | None = None
    stop: float | None = None
    target: float | None = None
    rr: float | None = None


class VolumeAnalysisResponse(BaseModel):
    symbol: str
    provider: str
    interval: str
    lookback: int
    data_quality: DataQualityOut
    profile_type: str
    market_bias: str
    setup_type: str
    action: str
    confidence_score: float
    rationale: list[str]
    key_levels: KeyLevelsOut
    volume_zones: list[VolumeZoneOut]
    trade_plan: TradePlanOut
    warnings: list[str]


def build_volume_analysis_response(
    analysis: VolumeZoneAnalysis, provider: str
) -> VolumeAnalysisResponse:
    return VolumeAnalysisResponse(
        symbol=analysis.symbol,
        provider=provider,
        interval=analysis.interval,
        lookback=analysis.lookback,
        data_quality=DataQualityOut(
            ok=analysis.data_quality.ok,
            bars=analysis.data_quality.bars,
            warnings=analysis.data_quality.warnings,
        ),
        profile_type=analysis.profile_type,
        market_bias=analysis.market_bias,
        setup_type=analysis.setup_type,
        action=analysis.action,
        confidence_score=analysis.confidence_score,
        rationale=analysis.rationale,
        key_levels=KeyLevelsOut(**analysis.key_levels.__dict__),
        volume_zones=[VolumeZoneOut(**z.__dict__) for z in analysis.volume_zones],
        trade_plan=TradePlanOut(**analysis.trade_plan.__dict__),
        warnings=analysis.warnings,
    )
