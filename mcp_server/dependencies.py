"""Shared dependencies for MCP server.

This module provides dependency injection setup for the MCP server,
reusing the same pattern and repositories from the FastAPI layer.

Note: Services are interface-agnostic and can be shared between
FastAPI and MCP without modification.
"""
from __future__ import annotations

from pathlib import Path

from api.repositories.intelligence_config_repo import IntelligenceConfigRepository
from api.repositories.intelligence_symbol_sets_repo import IntelligenceSymbolSetsRepository
from api.repositories.orders_repo import OrdersRepository
from api.repositories.positions_repo import PositionsRepository
from api.repositories.strategy_repo import StrategyRepository
from api.services.chat_service import ChatService
from api.services.daily_review_service import DailyReviewService
from api.services.intelligence_config_service import IntelligenceConfigService
from api.services.intelligence_service import IntelligenceService
from api.services.portfolio_service import PortfolioService
from api.services.screener_service import ScreenerService
from api.services.social_service import SocialService
from api.services.strategy_service import StrategyService
from api.services.workspace_context_service import WorkspaceContextService
from api.utils.file_lock import locked_write_json
from api.utils.files import get_today_str

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
    path = get_orders_path()
    if not path.exists():
        locked_write_json(path, {"asof": get_today_str(), "orders": []})
    return OrdersRepository(path)


def get_positions_repo() -> PositionsRepository:
    """Get positions repository instance."""
    path = get_positions_path()
    if not path.exists():
        locked_write_json(path, {"asof": get_today_str(), "positions": []})
    return PositionsRepository(path)


def get_strategy_repo() -> StrategyRepository:
    """Get strategy repository instance."""
    return StrategyRepository()


def get_intelligence_config_repo() -> IntelligenceConfigRepository:
    """Get intelligence config repository instance."""
    return IntelligenceConfigRepository()


def get_intelligence_symbol_sets_repo() -> IntelligenceSymbolSetsRepository:
    """Get intelligence symbol sets repository instance."""
    return IntelligenceSymbolSetsRepository()


def get_portfolio_service() -> PortfolioService:
    """Get portfolio service instance with injected dependencies."""
    return PortfolioService(
        orders_repo=get_orders_repo(),
        positions_repo=get_positions_repo(),
    )


def get_strategy_service() -> StrategyService:
    """Get strategy service instance with injected dependencies."""
    return StrategyService(strategy_repo=get_strategy_repo())


def get_intelligence_config_service() -> IntelligenceConfigService:
    """Get intelligence config service instance with injected dependencies."""
    return IntelligenceConfigService(
        strategy_repo=get_strategy_repo(),
        config_repo=get_intelligence_config_repo(),
        symbol_sets_repo=get_intelligence_symbol_sets_repo(),
    )


def get_screener_service() -> ScreenerService:
    """Get screener service instance with injected dependencies."""
    return ScreenerService(strategy_repo=get_strategy_repo())


def get_social_service() -> SocialService:
    """Get social service instance with injected dependencies."""
    return SocialService(strategy_repo=get_strategy_repo())


def get_intelligence_service() -> IntelligenceService:
    """Get intelligence service instance with injected dependencies."""
    return IntelligenceService(
        strategy_repo=get_strategy_repo(),
        config_service=get_intelligence_config_service(),
    )


def get_workspace_context_service() -> WorkspaceContextService:
    """Get workspace context service instance with injected dependencies."""
    return WorkspaceContextService(
        portfolio_service=get_portfolio_service(),
        strategy_service=get_strategy_service(),
        intelligence_service=get_intelligence_service(),
    )


def get_chat_service() -> ChatService:
    """Get chat service instance with injected dependencies."""
    return ChatService(
        workspace_context_service=get_workspace_context_service(),
        config_service=get_intelligence_config_service(),
    )


def get_daily_review_service() -> DailyReviewService:
    """Get daily_review service instance with injected dependencies."""
    return DailyReviewService(
        screener_service=get_screener_service(),
        portfolio_service=get_portfolio_service(),
        data_dir=DATA_DIR,
    )
