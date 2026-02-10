from __future__ import annotations

from typing import Dict

from swing_screener.strategies.base import StrategyModule


_REGISTRY: Dict[str, StrategyModule] = {}


def _ensure_defaults() -> None:
    if _REGISTRY:
        return
    from swing_screener.strategies.momentum import MomentumStrategyModule

    register(MomentumStrategyModule())


def register(module: StrategyModule) -> None:
    _REGISTRY[module.name] = module


def get_strategy_module(name: str | None) -> StrategyModule:
    _ensure_defaults()
    if not name:
        return _REGISTRY["momentum"]
    return _REGISTRY.get(name) or _REGISTRY["momentum"]


def list_strategy_modules() -> list[str]:
    _ensure_defaults()
    return sorted(_REGISTRY.keys())

