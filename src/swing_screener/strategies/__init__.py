"""Compatibility shim for legacy imports.

Use `swing_screener.strategy` as canonical import path.
"""

from swing_screener.strategy import StrategyModule
from swing_screener.strategy.registry import get_strategy_module, list_strategy_modules, register

__all__ = ["StrategyModule", "get_strategy_module", "list_strategy_modules", "register"]
