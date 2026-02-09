"""Strategy service."""
from __future__ import annotations

import datetime as dt
from fastapi import HTTPException

from api.models.strategy import (
    Strategy,
    StrategyCreateRequest,
    StrategyUpdateRequest,
    ActiveStrategyRequest,
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
        strategy = self._require_strategy(request.strategy_id)
        self._repo.set_active_strategy_id(request.strategy_id)
        return strategy

    def get_strategy(self, strategy_id: str) -> Strategy:
        return self._require_strategy(strategy_id)

    def create_strategy(self, request: StrategyCreateRequest) -> Strategy:
        if request.id == self._repo.default_strategy_id:
            raise HTTPException(status_code=400, detail="Cannot create strategy with reserved id 'default'.")

        strategies = self._repo.list_strategies()
        if any(s.get("id") == request.id for s in strategies):
            raise HTTPException(status_code=409, detail=f"Strategy already exists: {request.id}")

        ts = self._now_iso()
        payload = request.model_dump()
        payload["is_default"] = False
        payload["created_at"] = ts
        payload["updated_at"] = ts

        strategies.append(payload)
        self._repo.save_strategies(strategies)
        return payload

    def update_strategy(self, strategy_id: str, request: StrategyUpdateRequest) -> Strategy:
        strategies = self._repo.list_strategies()
        ts = self._now_iso()

        for idx, strategy in enumerate(strategies):
            if strategy.get("id") != strategy_id:
                continue

            updated = request.model_dump()
            updated["id"] = strategy_id
            updated["is_default"] = bool(strategy.get("is_default", False))
            updated["created_at"] = strategy.get("created_at", ts)
            updated["updated_at"] = ts

            strategies[idx] = updated
            self._repo.save_strategies(strategies)
            return updated

        raise HTTPException(status_code=404, detail=f"Strategy not found: {strategy_id}")

    def delete_strategy(self, strategy_id: str) -> dict:
        strategies = self._repo.list_strategies()

        if strategy_id == self._repo.default_strategy_id:
            raise HTTPException(status_code=400, detail="Default strategy cannot be deleted.")

        active_id = self._repo.get_active_strategy_id()

        kept: list[dict] = []
        removed = False
        for strategy in strategies:
            if strategy.get("id") == strategy_id:
                if strategy.get("is_default"):
                    raise HTTPException(status_code=400, detail="Default strategy cannot be deleted.")
                removed = True
                continue
            kept.append(strategy)

        if not removed:
            raise HTTPException(status_code=404, detail=f"Strategy not found: {strategy_id}")

        self._repo.save_strategies(kept)

        if active_id == strategy_id:
            self._repo.set_active_strategy_id(self._repo.default_strategy_id)

        return {"status": "deleted", "id": strategy_id}
