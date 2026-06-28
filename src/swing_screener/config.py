"""Main configuration module for swing_screener."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
import os

from swing_screener.settings import get_settings_manager


_VALID_PROVIDERS = ("yfinance", "alpaca", "polygon")


@dataclass
class BrokerConfig:
    """
    Broker and market data provider configuration.

    Attributes:
        provider: Market data provider ("yfinance", "alpaca", or "polygon")
        alpaca_api_key: Alpaca API key (required if provider="alpaca")
        alpaca_secret_key: Alpaca secret key (required if provider="alpaca")
        alpaca_paper: Use Alpaca paper trading account (default: True)
        polygon_api_key: Polygon.io API key (required if provider="polygon")
    """
    provider: str = "yfinance"
    alpaca_api_key: Optional[str] = None
    alpaca_secret_key: Optional[str] = None
    alpaca_paper: bool = True
    polygon_api_key: Optional[str] = None
    
    @classmethod
    def from_env(cls) -> BrokerConfig:
        """
        Load configuration from environment variables.
        
        Environment variables:
            - SWING_SCREENER_PROVIDER: Market data provider (default: "yfinance")
            - ALPACA_API_KEY: Alpaca API key
            - ALPACA_SECRET_KEY: Alpaca secret key
            - ALPACA_PAPER: Use paper account (default: "true")
            
        Returns:
            BrokerConfig instance
        """
        broker_defaults = get_settings_manager().get_low_level_defaults_payload("broker")
        provider = os.getenv(
            "SWING_SCREENER_PROVIDER",
            str(broker_defaults.get("provider", "yfinance")),
        ).lower()
        
        # Validate provider
        if provider not in _VALID_PROVIDERS:
            raise ValueError(f"Invalid provider: {provider}. Must be one of {_VALID_PROVIDERS}")
        
        # Get Alpaca credentials
        alpaca_api_key = os.getenv("ALPACA_API_KEY")
        alpaca_secret_key = os.getenv("ALPACA_SECRET_KEY")
        alpaca_paper_default = str(broker_defaults.get("alpaca_paper", True)).lower()
        alpaca_paper = os.getenv("ALPACA_PAPER", alpaca_paper_default).lower() in ("true", "1", "yes")
        
        # Validate Alpaca credentials if provider is alpaca
        if provider == "alpaca":
            if not alpaca_api_key or not alpaca_secret_key:
                raise ValueError(
                    "Alpaca provider requires ALPACA_API_KEY and ALPACA_SECRET_KEY environment variables"
                )
        
        polygon_api_key = os.getenv("POLYGON_IO_API_KEY")
        if provider == "polygon" and not polygon_api_key:
            raise ValueError(
                "Polygon provider requires POLYGON_IO_API_KEY environment variable"
            )

        return cls(
            provider=provider,
            alpaca_api_key=alpaca_api_key,
            alpaca_secret_key=alpaca_secret_key,
            alpaca_paper=alpaca_paper,
            polygon_api_key=polygon_api_key,
        )
    
    def validate(self):
        """
        Validate configuration.
        
        Raises:
            ValueError: If configuration is invalid
        """
        if self.provider not in _VALID_PROVIDERS:
            raise ValueError(f"Invalid provider: {self.provider}")

        if self.provider == "alpaca":
            if not self.alpaca_api_key or not self.alpaca_secret_key:
                raise ValueError("Alpaca provider requires api_key and secret_key")

        if self.provider == "polygon":
            if not self.polygon_api_key:
                raise ValueError("Polygon provider requires POLYGON_IO_API_KEY")
