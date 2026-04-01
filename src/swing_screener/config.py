"""Main configuration module for swing_screener."""
from __future__ import annotations

from dataclasses import dataclass
import os

from swing_screener.settings import get_settings_manager


@dataclass
class BrokerConfig:
    """Market data provider configuration."""

    provider: str = "yfinance"

    @classmethod
    def from_env(cls) -> BrokerConfig:
        """Load configuration from environment variables."""
        broker_defaults = get_settings_manager().get_low_level_defaults_payload("broker")
        provider = os.getenv(
            "SWING_SCREENER_PROVIDER",
            str(broker_defaults.get("provider", "yfinance")),
        ).lower()
        if provider != "yfinance":
            raise ValueError(
                f"Invalid provider: {provider}. The only supported provider is 'yfinance'."
            )
        return cls(provider=provider)

    def validate(self) -> None:
        """Validate configuration."""
        if self.provider != "yfinance":
            raise ValueError(
                f"Invalid provider: {self.provider}. The only supported provider is 'yfinance'."
            )
