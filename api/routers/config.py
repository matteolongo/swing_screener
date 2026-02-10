"""Config router - Settings CRUD."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from api.models.config import AppConfig, RiskConfig, IndicatorConfig, ManageConfig

router = APIRouter()

# Default configuration (matching web UI defaults)
DEFAULT_CONFIG = AppConfig(
    risk=RiskConfig(
        account_size=50000,
        risk_pct=0.01,
        max_position_pct=0.60,
        min_shares=1,
        k_atr=2.0,
    ),
    indicators=IndicatorConfig(
        sma_fast=20,
        sma_mid=50,
        sma_long=200,
        atr_window=14,
        lookback_6m=126,
        lookback_12m=252,
        benchmark="SPY",
        breakout_lookback=50,
        pullback_ma=20,
        min_history=260,
    ),
    manage=ManageConfig(
        breakeven_at_r=1.0,
        trail_after_r=2.0,
        trail_sma=20,
        sma_buffer_pct=0.005,
        max_holding_days=20,
    ),
    positions_file="data/positions.json",
    orders_file="data/orders.json",
)

# In-memory config storage (web UI uses localStorage, we'll keep it simple)
current_config = DEFAULT_CONFIG.model_copy(deep=True)


@router.get("", response_model=AppConfig)
async def get_config():
    """Get current application configuration."""
    return current_config


@router.put("", response_model=AppConfig)
async def update_config(config: AppConfig):
    """Update application configuration."""
    global current_config
    current_config = config.model_copy(deep=True)
    return current_config


@router.post("/reset", response_model=AppConfig)
async def reset_config():
    """Reset configuration to defaults."""
    global current_config
    current_config = DEFAULT_CONFIG.model_copy(deep=True)
    return current_config


@router.get("/defaults", response_model=AppConfig)
async def get_defaults():
    """Get default configuration."""
    return DEFAULT_CONFIG
