"""Strategy repository."""
from __future__ import annotations

from swing_screener.strategy.storage import (
    DEFAULT_STRATEGY_ID,
    load_strategies,
    save_strategies,
    load_active_strategy_id,
    set_active_strategy_id,
    get_active_strategy,
    get_strategy_by_id,
)


class StrategyRepository:
    def list_strategies(self) -> list[dict]:
        return load_strategies()

    def get_strategy(self, strategy_id: str) -> dict | None:
        return get_strategy_by_id(strategy_id)

    def get_active_strategy(self) -> dict:
        return get_active_strategy()

    def set_active_strategy_id(self, strategy_id: str) -> None:
        set_active_strategy_id(strategy_id)

    def save_strategies(self, strategies: list[dict]) -> None:
        save_strategies(strategies)

    def get_active_strategy_id(self) -> str:
        return load_active_strategy_id()

    @property
    def default_strategy_id(self) -> str:
        return DEFAULT_STRATEGY_ID
