"""Thread-safe configuration repository."""
from __future__ import annotations

import json
from pathlib import Path
from threading import Lock
from typing import Optional

from fastapi import HTTPException

from api.models.config import AppConfig, RiskConfig, IndicatorConfig, ManageConfig


# Default configuration (matching web UI defaults)
DEFAULT_CONFIG = AppConfig(
    risk=RiskConfig(
        account_size=50000,
        risk_pct=0.01,
        max_position_pct=0.60,
        min_shares=1,
        k_atr=2.0,
        min_rr=2.0,
        max_fee_risk_pct=0.2,
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


class ConfigRepository:
    """Thread-safe in-memory configuration repository.
    
    This replaces the global mutable config state with a thread-safe
    implementation using locks to prevent race conditions.
    """

    def __init__(
        self,
        initial_config: Optional[AppConfig] = None,
        path: Optional[Path] = None,
    ) -> None:
        """Initialize repository with optional config.
        
        Args:
            initial_config: Initial configuration. If None, uses DEFAULT_CONFIG.
        """
        self._lock = Lock()
        self._path = path
        default_config = (initial_config or DEFAULT_CONFIG).model_copy(deep=True)

        if self._path is None:
            self._config = default_config
            return

        self._path.parent.mkdir(parents=True, exist_ok=True)
        if self._path.exists():
            self._config = self._load_from_path(default_config=default_config)
        else:
            self._config = default_config
            self._persist(self._config)

    def _load_from_path(self, default_config: AppConfig) -> AppConfig:
        try:
            payload = json.loads(self._path.read_text(encoding="utf-8"))  # type: ignore[union-attr]
            return AppConfig.model_validate(payload)
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Invalid config file: {self._path.name}",  # type: ignore[union-attr]
            ) from exc

    def _persist(self, config: AppConfig) -> None:
        if self._path is None:
            return
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._path.write_text(
                json.dumps(config.model_dump(), indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to write config file: {self._path.name}",
            ) from exc

    def get(self) -> AppConfig:
        """Get current configuration (thread-safe copy).
        
        Returns:
            A deep copy of the current configuration.
        """
        with self._lock:
            return self._config.model_copy(deep=True)

    def update(self, config: AppConfig) -> AppConfig:
        """Update configuration atomically.
        
        Args:
            config: New configuration to set.
            
        Returns:
            A deep copy of the updated configuration.
        """
        with self._lock:
            self._config = config.model_copy(deep=True)
            self._persist(self._config)
            return self._config.model_copy(deep=True)

    def reset(self) -> AppConfig:
        """Reset configuration to defaults.
        
        Returns:
            A deep copy of the default configuration.
        """
        with self._lock:
            self._config = DEFAULT_CONFIG.model_copy(deep=True)
            self._persist(self._config)
            return self._config.model_copy(deep=True)

    @staticmethod
    def get_defaults() -> AppConfig:
        """Get default configuration (static method).
        
        Returns:
            A deep copy of the default configuration.
        """
        return DEFAULT_CONFIG.model_copy(deep=True)
