"""Shared dependencies for API routers."""
from __future__ import annotations

import hashlib
import os
import threading
from functools import lru_cache
from pathlib import Path
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from api.services.backtest_service import BacktestService

from fastapi import Depends
from alembic import command
from alembic.config import Config

from api.repositories.config_repo import ConfigRepository
from api.repositories.fundamentals_config_repo import FundamentalsConfigRepository
from api.repositories.review_queue_repo import ReviewQueueRepository
from api.repositories.screener_history_repo import ScreenerHistoryRepository
from api.repositories.strategy_repo import StrategyRepository
from api.repositories.symbol_pool_repo import SymbolPoolRepository
from api.repositories.watchlist_repo import WatchlistRepository
from api.repositories.weekly_reviews_repo import WeeklyReviewsRepository
from api.services.fundamentals_service import FundamentalsService
from api.services.cache_service import CacheService
from api.services.datasources_service import DatasourcesService
from api.services.orders_service import OrdersService
from api.services.order_approval_token import OrderApprovalTokenSigner
from api.security.settings import get_auth_settings
from api.services.portfolio_service import PortfolioService
from api.services.regime_analytics import RegimeAnalyticsService
from api.services.screener_service import ScreenerService
from api.services.strategy_service import StrategyService
from api.services.watchlist_service import WatchlistService
from swing_screener.settings import data_dir, get_settings_manager
from swing_screener.runtime_env import get_env_value
from api.db.import_legacy import LEGACY_IMPORT_SCHEMA_REVISION, import_legacy_portfolio
from api.db.repositories import SqlOrdersRepository, SqlPositionsRepository
from api.db.readiness import require_database_schema_at_head
from api.db.session import DatabaseRuntime, create_database_runtime
from api.db.settings import DatabaseSettings
from api.db.unit_of_work import PortfolioUnitOfWork
from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
from swing_screener.fundamentals import FundamentalsAnalysisService as _FundamentalsAnalysisService

_finnhub_client: FinnhubEnrichmentClient | None = None
_finnhub_client_api_key: str | None = None
_finnhub_client_lock = threading.Lock()


@lru_cache(maxsize=1)
def get_order_approval_signer() -> OrderApprovalTokenSigner:
    settings = get_auth_settings()
    return OrderApprovalTokenSigner(
        settings.order_approval_signing_key,
        ttl_seconds=settings.order_approval_ttl_seconds,
    )


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
_DEFAULT_POSITIONS_FILE = POSITIONS_FILE
_DEFAULT_ORDERS_FILE = ORDERS_FILE
WATCHLIST_FILE = get_settings_manager().resolve_runtime_path("watchlist_file", DATA_DIR / "watchlist.json")
SYMBOL_POOL_FILE = get_settings_manager().resolve_runtime_path("symbol_pool_file", DATA_DIR / "symbol_pool.json")
REVIEW_QUEUE_FILE = get_settings_manager().resolve_runtime_path("review_queue_file", DATA_DIR / "review_queue.json")

# Patchable path aliases used by tests (monkeypatch these to redirect I/O).
# Set to None to fall through to the module-level constants.
_positions_path: Optional[Path] = None
_orders_path: Optional[Path] = None

# Global singleton config repository (thread-safe)
_config_repository: Optional[ConfigRepository] = None
_config_repository_lock = threading.Lock()
_database_runtime_lock = threading.Lock()
_database_runtimes: dict[str, DatabaseRuntime] = {}


def get_positions_path() -> Path:
    """Get path to positions.json."""
    import api.dependencies as _self
    return _self._positions_path if _self._positions_path is not None else POSITIONS_FILE


def get_watchlist_path() -> Path:
    """Get path to watchlist.json."""
    return WATCHLIST_FILE


def get_orders_path() -> Path:
    import api.dependencies as _self

    return _self._orders_path if _self._orders_path is not None else ORDERS_FILE


def _alembic_upgrade(url: str) -> None:
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")


def _database_context() -> tuple[str, Path, Path, bool]:
    positions_path = get_positions_path()
    orders_path = get_orders_path()
    settings = DatabaseSettings.from_env()
    test_override = (
        _positions_path is not None
        or _orders_path is not None
        or positions_path != _DEFAULT_POSITIONS_FILE
        or orders_path != _DEFAULT_ORDERS_FILE
    )
    if settings.app_env == "test" and not settings.database_url_configured:
        if test_override:
            digest = hashlib.sha256(
                f"{orders_path.resolve()}|{positions_path.resolve()}".encode("utf-8")
            ).hexdigest()[:20]
            database_path = (
                Path.home()
                / ".cache"
                / "swing-screener-tests"
                / f"portfolio-{digest}-v2.db"
            )
        else:
            database_path = (
                Path.home()
                / ".cache"
                / f"swing-screener-test-{os.getpid()}-v2.db"
            )
        database_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{database_path}", orders_path, positions_path, True
    settings.validate_runtime()
    return settings.url, orders_path, positions_path, False


def get_database_runtime() -> DatabaseRuntime:
    url, orders_path, positions_path, auto_migrate = _database_context()
    runtime = _database_runtimes.get(url)
    if runtime is None:
        with _database_runtime_lock:
            runtime = _database_runtimes.get(url)
            if runtime is None:
                if auto_migrate:
                    _alembic_upgrade(url)
                runtime = create_database_runtime(url)
                try:
                    require_database_schema_at_head(runtime)
                except Exception:
                    runtime.engine.dispose()
                    raise

                def factory() -> PortfolioUnitOfWork:
                    return PortfolioUnitOfWork(runtime.session_factory)

                try:
                    import_legacy_portfolio(
                        factory,
                        orders_path,
                        positions_path,
                        LEGACY_IMPORT_SCHEMA_REVISION,
                    )
                except Exception:
                    runtime.engine.dispose()
                    raise
                _database_runtimes[url] = runtime
    return runtime


def get_portfolio_uow():
    runtime = get_database_runtime()
    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        yield uow


def get_positions_repo(
    uow: PortfolioUnitOfWork = Depends(get_portfolio_uow),
) -> SqlPositionsRepository:
    return uow.positions


def get_orders_repo(
    uow: PortfolioUnitOfWork = Depends(get_portfolio_uow),
) -> SqlOrdersRepository:
    return uow.orders


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
    orders_repo: SqlOrdersRepository = Depends(get_orders_repo),
    positions_repo: SqlPositionsRepository = Depends(get_positions_repo),
    config_repo: ConfigRepository = Depends(get_config_repo),
    strategy_repo: StrategyRepository = Depends(get_strategy_repo),
    approval_signer: OrderApprovalTokenSigner = Depends(get_order_approval_signer),
    uow: PortfolioUnitOfWork = Depends(get_portfolio_uow),
) -> OrdersService:
    return OrdersService(
        orders_repo=orders_repo,
        positions_repo=positions_repo,
        config_repo=config_repo,
        strategy_repo=strategy_repo,
        approval_signer=approval_signer,
        uow=uow,
    )


def get_portfolio_service(
    positions_repo: SqlPositionsRepository = Depends(get_positions_repo),
    config_repo: ConfigRepository = Depends(get_config_repo),
    uow: PortfolioUnitOfWork = Depends(get_portfolio_uow),
) -> PortfolioService:
    return PortfolioService(
        positions_repo=positions_repo, config_repo=config_repo, uow=uow
    )


def get_regime_analytics_service(
    positions_repo: SqlPositionsRepository = Depends(get_positions_repo),
) -> RegimeAnalyticsService:
    return RegimeAnalyticsService(positions_repo=positions_repo)


def get_strategy_service(
    strategy_repo: StrategyRepository = Depends(get_strategy_repo),
) -> StrategyService:
    return StrategyService(strategy_repo=strategy_repo)


def get_symbol_pool_repo() -> SymbolPoolRepository:
    return SymbolPoolRepository(SYMBOL_POOL_FILE)


def get_review_queue_repo() -> ReviewQueueRepository:
    return ReviewQueueRepository(REVIEW_QUEUE_FILE)


def get_screener_service(
    strategy_repo: StrategyRepository = Depends(get_strategy_repo),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
    orders_service: OrdersService = Depends(get_orders_service),
    pool_repo: SymbolPoolRepository = Depends(get_symbol_pool_repo),
    review_repo: ReviewQueueRepository = Depends(get_review_queue_repo),
    approval_signer: OrderApprovalTokenSigner = Depends(get_order_approval_signer),
) -> ScreenerService:
    return ScreenerService(
        strategy_repo=strategy_repo,
        portfolio_service=portfolio_service,
        orders_service=orders_service,
        pool_repo=pool_repo,
        review_repo=review_repo,
        approval_signer=approval_signer,
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

_datasources_service: DatasourcesService | None = None


def get_datasources_service() -> DatasourcesService:
    global _datasources_service
    if _datasources_service is None:
        _datasources_service = DatasourcesService()
    return _datasources_service
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
