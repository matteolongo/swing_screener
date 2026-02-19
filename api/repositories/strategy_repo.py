"""Strategy repository."""
from __future__ import annotations

import json
from pathlib import Path

from swing_screener.strategy.storage import (
    DEFAULT_STRATEGY_ID,
    _default_strategy_payload,
    load_strategies,
    save_strategies,
    load_active_strategy_id,
    set_active_strategy_id,
    get_active_strategy,
    get_strategy_by_id,
)


class StrategyRepository:
    def __init__(self, data_dir: Path | None = None) -> None:
        self._data_dir = data_dir
        self._strategies_file = self._data_dir / "strategies.json" if self._data_dir else None
        self._active_strategy_file = self._data_dir / "active_strategy.json" if self._data_dir else None

    def _is_tenant_scoped(self) -> bool:
        return self._data_dir is not None

    def _ensure_tenant_dir(self) -> None:
        if self._data_dir is None:
            return
        self._data_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _read_json(path: Path):
        return json.loads(path.read_text(encoding="utf-8"))

    @staticmethod
    def _write_json(path: Path, payload) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    def _load_tenant_strategies(self) -> list[dict]:
        assert self._strategies_file is not None
        self._ensure_tenant_dir()
        if not self._strategies_file.exists():
            payload = [_default_strategy_payload()]
            self._write_json(self._strategies_file, payload)
            return payload

        data = self._read_json(self._strategies_file)
        if not isinstance(data, list):
            raise ValueError("strategies.json must contain a list of strategies")

        dirty = False
        for strategy in data:
            if not isinstance(strategy, dict):
                continue
            universe = strategy.get("universe")
            if isinstance(universe, dict):
                filt = universe.get("filt")
                if isinstance(filt, dict) and filt.get("currencies") is None:
                    filt["currencies"] = ["USD", "EUR"]
                    dirty = True

            social_overlay = strategy.get("social_overlay")
            if isinstance(social_overlay, dict):
                if social_overlay.get("providers") is None:
                    social_overlay["providers"] = ["reddit"]
                    dirty = True
                if social_overlay.get("sentiment_analyzer") is None:
                    social_overlay["sentiment_analyzer"] = "keyword"
                    dirty = True

        if not any(isinstance(s, dict) and s.get("id") == DEFAULT_STRATEGY_ID for s in data):
            data.append(_default_strategy_payload())
            dirty = True

        if dirty:
            self._write_json(self._strategies_file, data)
        return data

    def _save_tenant_strategies(self, strategies: list[dict]) -> None:
        assert self._strategies_file is not None
        self._write_json(self._strategies_file, strategies)

    def _load_tenant_active_strategy_id(self) -> str:
        assert self._active_strategy_file is not None
        self._ensure_tenant_dir()
        if not self._active_strategy_file.exists():
            self._write_json(self._active_strategy_file, {"id": DEFAULT_STRATEGY_ID})
            return DEFAULT_STRATEGY_ID

        payload = self._read_json(self._active_strategy_file)
        if isinstance(payload, dict) and payload.get("id"):
            return str(payload["id"])

        self._write_json(self._active_strategy_file, {"id": DEFAULT_STRATEGY_ID})
        return DEFAULT_STRATEGY_ID

    def _set_tenant_active_strategy_id(self, strategy_id: str) -> None:
        assert self._active_strategy_file is not None
        self._write_json(self._active_strategy_file, {"id": strategy_id})

    def _get_tenant_active_strategy(self) -> dict:
        strategies = self._load_tenant_strategies()
        active_id = self._load_tenant_active_strategy_id()
        for strategy in strategies:
            if strategy.get("id") == active_id:
                return strategy
        for strategy in strategies:
            if strategy.get("id") == DEFAULT_STRATEGY_ID:
                self._set_tenant_active_strategy_id(DEFAULT_STRATEGY_ID)
                return strategy
        payload = _default_strategy_payload()
        self._save_tenant_strategies([payload])
        self._set_tenant_active_strategy_id(DEFAULT_STRATEGY_ID)
        return payload

    def list_strategies(self) -> list[dict]:
        if self._is_tenant_scoped():
            strategies = self._load_tenant_strategies()
            # Ensure active strategy pointer exists for tenant bootstrap parity.
            self._load_tenant_active_strategy_id()
            return strategies
        return load_strategies()

    def get_strategy(self, strategy_id: str) -> dict | None:
        if self._is_tenant_scoped():
            for strategy in self._load_tenant_strategies():
                if strategy.get("id") == str(strategy_id):
                    return strategy
            return None
        return get_strategy_by_id(strategy_id)

    def get_active_strategy(self) -> dict:
        if self._is_tenant_scoped():
            return self._get_tenant_active_strategy()
        return get_active_strategy()

    def set_active_strategy_id(self, strategy_id: str) -> None:
        if self._is_tenant_scoped():
            self._set_tenant_active_strategy_id(strategy_id)
            return
        set_active_strategy_id(strategy_id)

    def save_strategies(self, strategies: list[dict]) -> None:
        if self._is_tenant_scoped():
            self._save_tenant_strategies(strategies)
            return
        save_strategies(strategies)

    def get_active_strategy_id(self) -> str:
        if self._is_tenant_scoped():
            return self._load_tenant_active_strategy_id()
        return load_active_strategy_id()

    @property
    def default_strategy_id(self) -> str:
        return DEFAULT_STRATEGY_ID
