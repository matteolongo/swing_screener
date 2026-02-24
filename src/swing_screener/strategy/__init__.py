"""Strategy domain package."""

from swing_screener.strategy.base import StrategyModule
from swing_screener.strategy.report_config import ReportConfig
from swing_screener.strategy.config import (
    build_entry_config,
    build_manage_config,
    build_ranking_config,
    build_report_config,
    build_risk_config,
    build_social_overlay_config,
    build_universe_config,
)
from swing_screener.strategy.storage import (
    DEFAULT_STRATEGY_ID,
    get_active_strategy,
    get_strategy_by_id,
    load_active_strategy_id,
    load_strategies,
    save_strategies,
    set_active_strategy_id,
)
from swing_screener.strategy.registry import get_strategy_module, list_strategy_modules, register

__all__ = [
    "StrategyModule",
    "ReportConfig",
    "DEFAULT_STRATEGY_ID",
    "build_entry_config",
    "build_manage_config",
    "build_ranking_config",
    "build_report_config",
    "build_risk_config",
    "build_social_overlay_config",
    "build_universe_config",
    "get_active_strategy",
    "get_strategy_by_id",
    "load_active_strategy_id",
    "load_strategies",
    "save_strategies",
    "set_active_strategy_id",
    "get_strategy_module",
    "list_strategy_modules",
    "register",
]
