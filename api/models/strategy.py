"""Strategy models."""
from __future__ import annotations

from typing import Optional, Literal
from pydantic import BaseModel, Field

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


class StrategyBase(BaseModel):
    name: str
    description: Optional[str] = None
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
