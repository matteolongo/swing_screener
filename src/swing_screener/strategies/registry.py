"""Compatibility shim for legacy imports.

Use `swing_screener.strategy.registry` as canonical import path.
"""

from swing_screener.strategy.registry import (
    get_strategy_module,
    list_strategy_modules,
    register,
)

__all__ = ["get_strategy_module", "list_strategy_modules", "register"]
