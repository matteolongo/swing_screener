"""Shared dependencies for API routers."""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import Depends

from api.repositories.config_repo import ConfigRepository
from api.repositories.orders_repo import OrdersRepository
from api.repositories.positions_repo import PositionsRepository
from api.repositories.strategy_repo import StrategyRepository
from api.services.backtest_service import BacktestService
from api.services.intelligence_service import IntelligenceService
from api.services.portfolio_service import PortfolioService
from api.services.screener_service import ScreenerService
from api.services.social_service import SocialService
from api.services.strategy_service import StrategyService
from api.utils.files import read_json_file, write_json_file, get_today_str

# Repository root
ROOT_DIR = Path(__file__).parent.parent.resolve()
DATA_DIR = ROOT_DIR / "data"
POSITIONS_FILE = DATA_DIR / "positions.json"
ORDERS_FILE = DATA_DIR / "orders.json"

# Global singleton config repository (thread-safe)
_config_repository: Optional[ConfigRepository] = None


def get_positions_path() -> Path:
    """Get path to positions.json."""
    return POSITIONS_FILE


def get_orders_path() -> Path:
    """Get path to orders.json."""
    return ORDERS_FILE


def get_orders_repo() -> OrdersRepository:
    return OrdersRepository(get_orders_path())


def get_positions_repo() -> PositionsRepository:
    return PositionsRepository(get_positions_path())


def get_strategy_repo() -> StrategyRepository:
    return StrategyRepository()


def get_config_repo() -> ConfigRepository:
    """Get the singleton config repository (thread-safe).
    
    Returns a singleton instance to maintain config state across requests.
    """
    global _config_repository
    if _config_repository is None:
        _config_repository = ConfigRepository()
    return _config_repository


def get_portfolio_service(
    orders_repo: OrdersRepository = Depends(get_orders_repo),
    positions_repo: PositionsRepository = Depends(get_positions_repo),
) -> PortfolioService:
    return PortfolioService(orders_repo=orders_repo, positions_repo=positions_repo)


def get_strategy_service(
    strategy_repo: StrategyRepository = Depends(get_strategy_repo),
) -> StrategyService:
    return StrategyService(strategy_repo=strategy_repo)


def get_screener_service(
    strategy_repo: StrategyRepository = Depends(get_strategy_repo),
) -> ScreenerService:
    return ScreenerService(strategy_repo=strategy_repo)


def get_backtest_service(
    strategy_repo: StrategyRepository = Depends(get_strategy_repo),
) -> BacktestService:
    return BacktestService(strategy_repo=strategy_repo)


def get_social_service(
    strategy_repo: StrategyRepository = Depends(get_strategy_repo),
) -> SocialService:
    return SocialService(strategy_repo=strategy_repo)


def get_intelligence_service(
    strategy_repo: StrategyRepository = Depends(get_strategy_repo),
) -> IntelligenceService:
    return IntelligenceService(strategy_repo=strategy_repo)
