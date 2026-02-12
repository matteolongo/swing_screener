"""Shared dependencies for MCP server.

This module provides dependency injection setup for the MCP server,
reusing the same pattern and repositories from the FastAPI layer.

Note: Services are interface-agnostic and can be shared between
FastAPI and MCP without modification.
"""
from __future__ import annotations

from pathlib import Path

from api.repositories.orders_repo import OrdersRepository
from api.repositories.positions_repo import PositionsRepository
from api.repositories.strategy_repo import StrategyRepository
from api.services.backtest_service import BacktestService
from api.services.portfolio_service import PortfolioService
from api.services.screener_service import ScreenerService
from api.services.social_service import SocialService
from api.services.strategy_service import StrategyService

# Repository root (same as api/dependencies.py)
ROOT_DIR = Path(__file__).parent.parent.resolve()
DATA_DIR = ROOT_DIR / "data"
POSITIONS_FILE = DATA_DIR / "positions.json"
ORDERS_FILE = DATA_DIR / "orders.json"


def get_positions_path() -> Path:
    """Get path to positions.json."""
    return POSITIONS_FILE


def get_orders_path() -> Path:
    """Get path to orders.json."""
    return ORDERS_FILE


def get_orders_repo() -> OrdersRepository:
    """Get orders repository instance."""
    return OrdersRepository(get_orders_path())


def get_positions_repo() -> PositionsRepository:
    """Get positions repository instance."""
    return PositionsRepository(get_positions_path())


def get_strategy_repo() -> StrategyRepository:
    """Get strategy repository instance."""
    return StrategyRepository()


def get_portfolio_service() -> PortfolioService:
    """Get portfolio service instance with injected dependencies."""
    return PortfolioService(
        orders_repo=get_orders_repo(),
        positions_repo=get_positions_repo(),
    )


def get_strategy_service() -> StrategyService:
    """Get strategy service instance with injected dependencies."""
    return StrategyService(strategy_repo=get_strategy_repo())


def get_screener_service() -> ScreenerService:
    """Get screener service instance with injected dependencies."""
    return ScreenerService(strategy_repo=get_strategy_repo())


def get_backtest_service() -> BacktestService:
    """Get backtest service instance with injected dependencies."""
    return BacktestService(strategy_repo=get_strategy_repo())


def get_social_service() -> SocialService:
    """Get social service instance with injected dependencies."""
    return SocialService(strategy_repo=get_strategy_repo())
