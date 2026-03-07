"""Strategy service."""
from __future__ import annotations

import datetime as dt
from fastapi import HTTPException

from api.models.strategy import (
    Strategy,
    StrategyCreateRequest,
    StrategyUpdateRequest,
    ActiveStrategyRequest,
    StrategyValidationResult,
)
from api.models.strategy_runtime import (
    StrategyPluginDefinition,
    StrategyResolvedConfig,
)
from api.repositories.strategy_repo import StrategyRepository


class StrategyService:
    def __init__(self, strategy_repo: StrategyRepository) -> None:
        self._repo = strategy_repo

    def _now_iso(self) -> str:
        return dt.datetime.now().replace(microsecond=0).isoformat()

    def _require_strategy(self, strategy_id: str) -> dict:
        strategy = self._repo.get_strategy(strategy_id)
        if strategy is None:
            raise HTTPException(status_code=404, detail=f"Strategy not found: {strategy_id}")
        return strategy

    def list_strategies(self) -> list[Strategy]:
        return self._repo.list_strategies()

    def get_active_strategy(self) -> Strategy:
        return self._repo.get_active_strategy()

    def set_active_strategy(self, request: ActiveStrategyRequest) -> Strategy:
        raise HTTPException(status_code=405, detail="Strategy activation is not supported in YAML read-only mode.")

    def get_strategy(self, strategy_id: str) -> Strategy:
        return self._require_strategy(strategy_id)

    def create_strategy(self, request: StrategyCreateRequest) -> Strategy:
        raise HTTPException(status_code=405, detail="Strategy editing is not supported in YAML read-only mode.")

    def update_strategy(self, strategy_id: str, request: StrategyUpdateRequest) -> Strategy:
        raise HTTPException(status_code=405, detail="Strategy editing is not supported in YAML read-only mode.")

    def delete_strategy(self, strategy_id: str) -> dict:
        raise HTTPException(status_code=405, detail="Strategy editing is not supported in YAML read-only mode.")

    def get_resolved_config(self) -> StrategyResolvedConfig:
        return StrategyResolvedConfig.model_validate(self._repo.get_resolved_config())

    def list_plugins(self) -> list[StrategyPluginDefinition]:
        return [StrategyPluginDefinition.model_validate(plugin) for plugin in self._repo.list_plugin_definitions()]

    def get_validation(self) -> StrategyValidationResult:
        return StrategyValidationResult.model_validate(self._repo.validate_config())
