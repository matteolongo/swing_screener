"""Strategy models."""
from __future__ import annotations

from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator

from api.models.backtest import FullEntryType


class StrategyTrend(BaseModel):
    sma_fast: int = Field(gt=0)
    sma_mid: int = Field(gt=0)
    sma_long: int = Field(gt=0)


class StrategyVol(BaseModel):
    atr_window: int = Field(gt=0)


class StrategyMom(BaseModel):
    lookback_6m: int = Field(gt=0)
    lookback_12m: int = Field(gt=0)
    benchmark: str


class StrategyFilt(BaseModel):
    min_price: float = Field(ge=0)
    max_price: float = Field(gt=0)
    max_atr_pct: float = Field(gt=0)
    require_trend_ok: bool = True
    require_rs_positive: bool = False
    currencies: list[str] = Field(default_factory=lambda: ["USD", "EUR"])

    @field_validator("currencies")
    @classmethod
    def validate_currencies(cls, values: list[str]) -> list[str]:
        cleaned = [str(v).strip().upper() for v in values if str(v).strip()]
        if not cleaned:
            return ["USD", "EUR"]
        invalid = [v for v in cleaned if v not in {"USD", "EUR"}]
        if invalid:
            raise ValueError(f"Unsupported currency codes: {', '.join(invalid)}")
        return list(dict.fromkeys(cleaned))


class StrategyUniverse(BaseModel):
    trend: StrategyTrend
    vol: StrategyVol
    mom: StrategyMom
    filt: StrategyFilt


class StrategyRanking(BaseModel):
    w_mom_6m: float = Field(gt=0)
    w_mom_12m: float = Field(gt=0)
    w_rs_6m: float = Field(gt=0)
    top_n: int = Field(gt=0)


class StrategySignals(BaseModel):
    breakout_lookback: int = Field(gt=0)
    pullback_ma: int = Field(gt=0)
    min_history: int = Field(gt=0)


class StrategyRisk(BaseModel):
    account_size: float = Field(gt=0)
    risk_pct: float = Field(gt=0, le=1)
    max_position_pct: float = Field(gt=0, le=1)
    min_shares: int = Field(ge=1)
    k_atr: float = Field(gt=0)
    min_rr: float = Field(gt=0, default=2.0)
    max_fee_risk_pct: float = Field(ge=0, le=1, default=0.2)
    regime_enabled: bool = False
    regime_trend_sma: int = Field(gt=1, default=200)
    regime_trend_multiplier: float = Field(gt=0, le=1, default=0.5)
    regime_vol_atr_window: int = Field(gt=1, default=14)
    regime_vol_atr_pct_threshold: float = Field(ge=0, default=6.0)
    regime_vol_multiplier: float = Field(gt=0, le=1, default=0.5)


class StrategyManage(BaseModel):
    breakeven_at_r: float = Field(ge=0)
    trail_after_r: float = Field(ge=0)
    trail_sma: int = Field(gt=0)
    sma_buffer_pct: float = Field(ge=0)
    max_holding_days: int = Field(gt=0)
    benchmark: str


class StrategyBacktest(BaseModel):
    entry_type: FullEntryType = "auto"
    exit_mode: Literal["take_profit", "trailing_stop"] = "trailing_stop"
    take_profit_r: float = Field(gt=0)
    max_holding_days: int = Field(gt=0)
    breakeven_at_r: float = Field(ge=0)
    trail_after_r: float = Field(ge=0)
    trail_sma: int = Field(gt=0)
    sma_buffer_pct: float = Field(ge=0)
    commission_pct: float = Field(ge=0)
    min_history: int = Field(gt=0)


class StrategySocialOverlay(BaseModel):
    enabled: bool = False
    lookback_hours: int = Field(default=24, ge=1)
    attention_z_threshold: float = Field(default=3.0, ge=0)
    min_sample_size: int = Field(default=20, ge=0)
    negative_sent_threshold: float = Field(default=-0.4)
    sentiment_conf_threshold: float = Field(default=0.7, ge=0, le=1)
    hype_percentile_threshold: float = Field(default=95.0, ge=0, le=100)
    providers: list[str] = Field(default_factory=lambda: ["reddit"])
    sentiment_analyzer: str = Field(default="keyword")


class StrategyBase(BaseModel):
    name: str
    description: Optional[str] = None
    module: str = "momentum"
    universe: StrategyUniverse
    ranking: StrategyRanking
    signals: StrategySignals
    risk: StrategyRisk
    manage: StrategyManage
    backtest: StrategyBacktest
    social_overlay: StrategySocialOverlay = Field(default_factory=StrategySocialOverlay)


class StrategyCreateRequest(StrategyBase):
    id: str


class StrategyUpdateRequest(StrategyBase):
    pass


class Strategy(StrategyBase):
    id: str
    is_default: bool = False
    created_at: str
    updated_at: str


class ActiveStrategyRequest(BaseModel):
    strategy_id: str


class ValidationWarningModel(BaseModel):
    """Validation warning for a strategy parameter."""

    parameter: str = Field(..., description="Parameter name that triggered warning")
    level: Literal["danger", "warning", "info"] = Field(..., description="Warning severity")
    message: str = Field(..., description="Human-readable warning message")


class StrategyValidationResult(BaseModel):
    """Result payload for strategy validation."""

    is_valid: bool = Field(..., description="True if no danger-level warnings are present")
    warnings: list[ValidationWarningModel] = Field(default_factory=list)
    safety_score: int = Field(..., ge=0, le=100)
    safety_level: Literal["beginner-safe", "requires-discipline", "expert-only"]
    total_warnings: int = Field(..., ge=0)
    danger_count: int = Field(..., ge=0)
    warning_count: int = Field(..., ge=0)
    info_count: int = Field(..., ge=0)
