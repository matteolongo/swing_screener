"""Shared dependencies for API routers."""
from __future__ import annotations

import threading
from pathlib import Path
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from api.services.backtest_service import BacktestService

from fastapi import Depends

from api.repositories.config_repo import ConfigRepository
from api.repositories.fundamentals_config_repo import FundamentalsConfigRepository
from api.repositories.orders_repo import OrdersRepository
from api.repositories.positions_repo import PositionsRepository
from api.repositories.screener_history_repo import ScreenerHistoryRepository
from api.repositories.strategy_repo import StrategyRepository
from api.repositories.watchlist_repo import WatchlistRepository
from api.repositories.weekly_reviews_repo import WeeklyReviewsRepository
from api.services.fundamentals_service import FundamentalsService
from api.services.orders_service import OrdersService
from api.services.portfolio_service import PortfolioService
from api.services.regime_analytics import RegimeAnalyticsService
from api.services.screener_service import ScreenerService
from api.services.strategy_service import StrategyService
from api.services.watchlist_service import WatchlistService
from api.utils.files import get_today_str
from swing_screener.settings import data_dir, get_settings_manager
from swing_screener.runtime_env import get_env_value
from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
from swing_screener.fundamentals import FundamentalsAnalysisService as _FundamentalsAnalysisService

_finnhub_client: FinnhubEnrichmentClient | None = None
_finnhub_client_api_key: str | None = None
_finnhub_client_lock = threading.Lock()


def get_finnhub_client() -> FinnhubEnrichmentClient | None:
    """Return a lazily initialized Finnhub client after repo-root .env loading.

    api.main imports routers before it calls ensure_runtime_env_loaded(), and those
    router imports load this module. Building the client at import time therefore
    misses FINNHUB_API_KEY values that exist only in .env. Resolve the key lazily
    so endpoint dependency construction sees the final runtime environment.
    """
    global _finnhub_client, _finnhub_client_api_key
    api_key = get_env_value("FINNHUB_API_KEY", "").strip()
    if not api_key:
        return None
    if _finnhub_client is not None and _finnhub_client_api_key == api_key:
        return _finnhub_client
    with _finnhub_client_lock:
        if _finnhub_client is None or _finnhub_client_api_key != api_key:
            _finnhub_client = FinnhubEnrichmentClient(api_key)
            _finnhub_client_api_key = api_key
        return _finnhub_client

# Repository root
DATA_DIR = data_dir()
POSITIONS_FILE = get_settings_manager().resolve_runtime_path("positions_file", DATA_DIR / "positions.json")
ORDERS_FILE = DATA_DIR / "orders.json"
WATCHLIST_FILE = get_settings_manager().resolve_runtime_path("watchlist_file", DATA_DIR / "watchlist.json")

# Patchable path aliases used by tests (monkeypatch these to redirect I/O).
# Set to None to fall through to the module-level constants.
_positions_path: Optional[Path] = None
_orders_path: Optional[Path] = None

# Global singleton config repository (thread-safe)
_config_repository: Optional[ConfigRepository] = None
_config_repository_lock = threading.Lock()


def get_positions_path() -> Path:
    """Get path to positions.json."""
    import api.dependencies as _self
    return _self._positions_path if _self._positions_path is not None else POSITIONS_FILE


def get_watchlist_path() -> Path:
    """Get path to watchlist.json."""
    return WATCHLIST_FILE


def get_positions_repo() -> PositionsRepository:
    path = get_positions_path()
    if not path.exists():
        from api.utils.file_lock import locked_write_json
        locked_write_json(path, {"asof": get_today_str(), "positions": []})
    return PositionsRepository(path)


def get_orders_repo() -> OrdersRepository:
    import api.dependencies as _self
    path = _self._orders_path if _self._orders_path is not None else ORDERS_FILE
    if not path.exists():
        from api.utils.file_lock import locked_write_json
        locked_write_json(path, {"asof": get_today_str(), "orders": []})
    return OrdersRepository(path)


def get_watchlist_repo() -> WatchlistRepository:
    return WatchlistRepository(get_watchlist_path())


def get_strategy_repo() -> StrategyRepository:
    return StrategyRepository()


def get_watchlist_service(
    watchlist_repo: WatchlistRepository = Depends(get_watchlist_repo),
    strategy_repo: StrategyRepository = Depends(get_strategy_repo),
) -> WatchlistService:
    return WatchlistService(repo=watchlist_repo, strategy_repo=strategy_repo)


def get_fundamentals_config_repo() -> FundamentalsConfigRepository:
    return FundamentalsConfigRepository()


def get_config_repo() -> ConfigRepository:
    """Get the singleton config repository (thread-safe).
    
    Returns a singleton instance to maintain config state across requests.
    Uses double-checked locking for thread-safe lazy initialization.
    """
    global _config_repository
    if _config_repository is None:
        with _config_repository_lock:
            # Double-check inside the lock
            if _config_repository is None:
                _config_repository = ConfigRepository()
    return _config_repository


def get_orders_service(
    orders_repo: OrdersRepository = Depends(get_orders_repo),
    positions_repo: PositionsRepository = Depends(get_positions_repo),
) -> OrdersService:
    return OrdersService(orders_repo=orders_repo, positions_repo=positions_repo)


def get_portfolio_service(
    positions_repo: PositionsRepository = Depends(get_positions_repo),
    config_repo: ConfigRepository = Depends(get_config_repo),
) -> PortfolioService:
    return PortfolioService(positions_repo=positions_repo, config_repo=config_repo)


def get_regime_analytics_service(
    positions_repo: PositionsRepository = Depends(get_positions_repo),
) -> RegimeAnalyticsService:
    return RegimeAnalyticsService(positions_repo=positions_repo)


def get_strategy_service(
    strategy_repo: StrategyRepository = Depends(get_strategy_repo),
) -> StrategyService:
    return StrategyService(strategy_repo=strategy_repo)


def get_screener_service(
    strategy_repo: StrategyRepository = Depends(get_strategy_repo),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
    orders_service: OrdersService = Depends(get_orders_service),
) -> ScreenerService:
    return ScreenerService(
        strategy_repo=strategy_repo,
        portfolio_service=portfolio_service,
        orders_service=orders_service,
    )


def get_backtest_service(
    strategy_repo: StrategyRepository = Depends(get_strategy_repo),
) -> "BacktestService":
    from api.services.backtest_service import BacktestService

    return BacktestService(strategy_repo=strategy_repo)


def get_fundamentals_service(
    config_repo: FundamentalsConfigRepository = Depends(get_fundamentals_config_repo),
) -> FundamentalsService:
    return FundamentalsService(
        config_repo=config_repo,
        analysis_service=_FundamentalsAnalysisService(finnhub_client=get_finnhub_client()),
    )



from api.services.datasources_service import DatasourcesService

_datasources_service: DatasourcesService | None = None


def get_datasources_service() -> DatasourcesService:
    global _datasources_service
    if _datasources_service is None:
        _datasources_service = DatasourcesService()
    return _datasources_service


from api.services.cache_service import CacheService

_cache_service: CacheService | None = None


def get_cache_service() -> CacheService:
    global _cache_service
    if _cache_service is None:
        _cache_service = CacheService()
    return _cache_service


SCREENER_HISTORY_FILE = DATA_DIR / "screener_history.json"

def get_screener_history_repo() -> ScreenerHistoryRepository:
    return ScreenerHistoryRepository(SCREENER_HISTORY_FILE)


WEEKLY_REVIEWS_FILE = DATA_DIR / "weekly_reviews.json"

def get_weekly_reviews_repo() -> WeeklyReviewsRepository:
    return WeeklyReviewsRepository(WEEKLY_REVIEWS_FILE)
