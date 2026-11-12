"""Strategy domain package."""

from swing_screener.strategy.report_config import ReportConfig
from swing_screener.strategy.config import (
    build_entry_config,
    build_manage_config,
    build_ranking_config,
    build_report_config,
    build_risk_config,
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

__all__ = [
    "ReportConfig",
    "DEFAULT_STRATEGY_ID",
    "build_entry_config",
    "build_manage_config",
    "build_ranking_config",
    "build_report_config",
    "build_risk_config",
    "build_universe_config",
    "get_active_strategy",
    "get_strategy_by_id",
    "load_active_strategy_id",
    "load_strategies",
    "save_strategies",
    "set_active_strategy_id",
]
