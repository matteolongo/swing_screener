"""Main configuration module for swing_screener."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
import os


@dataclass
class BrokerConfig:
    """
    Broker and market data provider configuration.
    
    Attributes:
        provider: Market data provider ("yfinance" or "alpaca")
        alpaca_api_key: Alpaca API key (required if provider="alpaca")
        alpaca_secret_key: Alpaca secret key (required if provider="alpaca")
        alpaca_paper: Use Alpaca paper trading account (default: True)
    """
    provider: str = "yfinance"
    alpaca_api_key: Optional[str] = None
    alpaca_secret_key: Optional[str] = None
    alpaca_paper: bool = True
    
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
        provider = os.getenv("SWING_SCREENER_PROVIDER", "yfinance").lower()
        
        # Validate provider
        if provider not in ("yfinance", "alpaca"):
            raise ValueError(f"Invalid provider: {provider}. Must be 'yfinance' or 'alpaca'")
        
        # Get Alpaca credentials
        alpaca_api_key = os.getenv("ALPACA_API_KEY")
        alpaca_secret_key = os.getenv("ALPACA_SECRET_KEY")
        alpaca_paper = os.getenv("ALPACA_PAPER", "true").lower() in ("true", "1", "yes")
        
        # Validate Alpaca credentials if provider is alpaca
        if provider == "alpaca":
            if not alpaca_api_key or not alpaca_secret_key:
                raise ValueError(
                    "Alpaca provider requires ALPACA_API_KEY and ALPACA_SECRET_KEY environment variables"
                )
        
        return cls(
            provider=provider,
            alpaca_api_key=alpaca_api_key,
            alpaca_secret_key=alpaca_secret_key,
            alpaca_paper=alpaca_paper,
        )
    
    def validate(self):
        """
        Validate configuration.
        
        Raises:
            ValueError: If configuration is invalid
        """
        if self.provider not in ("yfinance", "alpaca"):
            raise ValueError(f"Invalid provider: {self.provider}")
        
        if self.provider == "alpaca":
            if not self.alpaca_api_key or not self.alpaca_secret_key:
                raise ValueError("Alpaca provider requires api_key and secret_key")
