"""Factory for broker execution providers."""
from __future__ import annotations

import os
from typing import Optional

from swing_screener.config import BrokerConfig

from .alpaca_execution_provider import AlpacaExecutionProvider
from .base import ExecutionProvider


def get_execution_provider(
    provider: Optional[str] = None,
    **kwargs,
) -> Optional[ExecutionProvider]:
    """
    Resolve execution provider from configuration.

    Environment variables:
    - SWING_SCREENER_EXECUTION_PROVIDER: local | alpaca
    - ALPACA_API_KEY / ALPACA_SECRET_KEY / ALPACA_PAPER
    """
    provider_name = (provider or os.getenv("SWING_SCREENER_EXECUTION_PROVIDER", "local")).strip().lower()

    if provider_name in {"", "local", "none"}:
        return None

    if provider_name == "alpaca":
        cfg = BrokerConfig.from_env()
        if not cfg.alpaca_api_key or not cfg.alpaca_secret_key:
            raise ValueError(
                "Execution provider 'alpaca' requires ALPACA_API_KEY and ALPACA_SECRET_KEY."
            )
        return AlpacaExecutionProvider(
            api_key=cfg.alpaca_api_key,
            secret_key=cfg.alpaca_secret_key,
            paper=kwargs.get("paper", cfg.alpaca_paper),
        )

    raise ValueError(
        f"Unknown execution provider: {provider_name}. "
        "Supported values: local, alpaca."
    )

