"""Strategy models."""
from __future__ import annotations

from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator, model_validator


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
    rr_target: float = Field(gt=0, default=2.0)
    commission_pct: float = Field(ge=0, default=0.0)
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


class StrategyIntelligenceLLM(BaseModel):
    enabled: bool = False
    provider: Literal["mock", "openai"] = "openai"
    model: str = "gpt-4.1-mini"
    base_url: str = "https://api.openai.com/v1"
    enable_cache: bool = True
    enable_audit: bool = True
    cache_path: str = "data/intelligence/llm_cache.json"
    audit_path: str = "data/intelligence/llm_audit"
    max_concurrency: int = Field(default=4, ge=1, le=16)

    @model_validator(mode="after")
    def coerce_mock_fields(self) -> "StrategyIntelligenceLLM":
        if self.provider != "mock":
            return self
        self.model = "mock-classifier"
        self.base_url = ""
        return self


class StrategyIntelligenceCatalyst(BaseModel):
    lookback_hours: int = Field(default=72, ge=1)
    recency_half_life_hours: int = Field(default=36, ge=1)
    false_catalyst_return_z: float = Field(default=1.5, ge=0)
    min_price_reaction_atr: float = Field(default=0.8, ge=0)
    require_price_confirmation: bool = True


class StrategyIntelligenceTheme(BaseModel):
    enabled: bool = True
    min_cluster_size: int = Field(default=3, ge=1)
    min_peer_confirmation: int = Field(default=2, ge=1)
    curated_peer_map_path: str = "data/intelligence/peer_map.yaml"


class StrategyIntelligenceOpportunity(BaseModel):
    technical_weight: float = Field(default=0.55, ge=0)
    catalyst_weight: float = Field(default=0.45, ge=0)
    max_daily_opportunities: int = Field(default=8, ge=1, le=20)
    min_opportunity_score: float = Field(default=0.55, ge=0, le=1)


class StrategyMarketIntelligence(BaseModel):
    enabled: bool = False
    providers: list[str] = Field(default_factory=lambda: ["yahoo_finance"])
    universe_scope: Literal["screener_universe", "strategy_universe"] = "screener_universe"
    market_context_symbols: list[str] = Field(
        default_factory=lambda: ["SPY", "QQQ", "XLK", "SMH", "XBI"]
    )
    llm: StrategyIntelligenceLLM = Field(default_factory=StrategyIntelligenceLLM)
    catalyst: StrategyIntelligenceCatalyst = Field(default_factory=StrategyIntelligenceCatalyst)
    theme: StrategyIntelligenceTheme = Field(default_factory=StrategyIntelligenceTheme)
    opportunity: StrategyIntelligenceOpportunity = Field(default_factory=StrategyIntelligenceOpportunity)

    @field_validator("providers")
    @classmethod
    def validate_intel_providers(cls, values: list[str]) -> list[str]:
        cleaned: list[str] = []
        for value in values:
            text = str(value).strip().lower()
            if not text:
                continue
            if text not in {"yahoo_finance", "earnings_calendar"}:
                continue
            if text not in cleaned:
                cleaned.append(text)
        return cleaned or ["yahoo_finance"]

    @field_validator("market_context_symbols")
    @classmethod
    def validate_market_context_symbols(cls, values: list[str]) -> list[str]:
        cleaned: list[str] = []
        for value in values:
            text = str(value).strip().upper()
            if not text:
                continue
            if text not in cleaned:
                cleaned.append(text)
        return cleaned or ["SPY", "QQQ", "XLK", "SMH", "XBI"]


class StrategyBase(BaseModel):
    name: str
    description: Optional[str] = None
    module: str = "momentum"
    universe: StrategyUniverse
    ranking: StrategyRanking
    signals: StrategySignals
    risk: StrategyRisk
    manage: StrategyManage
    market_intelligence: StrategyMarketIntelligence = Field(default_factory=StrategyMarketIntelligence)


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
