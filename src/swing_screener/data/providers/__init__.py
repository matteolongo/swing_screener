"""Market data provider abstractions for broker integration."""

from .base import MarketDataProvider
from .yfinance_provider import YfinanceProvider
from .factory import get_market_data_provider, get_default_provider

try:
    from .alpaca_provider import AlpacaDataProvider
except ModuleNotFoundError as exc:
    _ALPACA_IMPORT_ERROR = exc

    class AlpacaDataProvider:  # type: ignore[no-redef]
        """Placeholder when alpaca-py is not installed."""

        def __init__(self, *args, **kwargs):
            raise ModuleNotFoundError(
                "alpaca-py is required for AlpacaDataProvider. "
                "Install it with `pip install alpaca-py`."
            ) from _ALPACA_IMPORT_ERROR

__all__ = [
    "MarketDataProvider",
    "YfinanceProvider",
    "AlpacaDataProvider",
    "get_market_data_provider",
    "get_default_provider",
]
