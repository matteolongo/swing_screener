"""Shared dependencies for API routers."""
from __future__ import annotations

import threading
from pathlib import Path
from typing import Optional

from fastapi import Depends

from api.repositories.config_repo import ConfigRepository
from api.repositories.fundamentals_config_repo import FundamentalsConfigRepository
from api.repositories.orders_repo import OrdersRepository
from api.repositories.positions_repo import PositionsRepository
from api.repositories.strategy_repo import StrategyRepository
from api.repositories.intelligence_config_repo import IntelligenceConfigRepository
from api.repositories.intelligence_symbol_sets_repo import IntelligenceSymbolSetsRepository
from api.repositories.watchlist_repo import WatchlistRepository
from api.services.agent_chat_service import AgentChatService
from api.services.agent_runtime import AgentRuntime
from api.services.chat_service import ChatService
from api.services.fundamentals_service import FundamentalsService
from api.services.intelligence_config_service import IntelligenceConfigService
from api.services.intelligence_service import IntelligenceService
from api.services.portfolio_service import PortfolioService
from api.services.screener_service import ScreenerService
from api.services.strategy_service import StrategyService
from api.services.workspace_context_service import WorkspaceContextService
from api.utils.files import read_json_file, write_json_file, get_today_str
from swing_screener.settings import data_dir, get_settings_manager, project_root

# Repository root
ROOT_DIR = project_root()
DATA_DIR = data_dir()
POSITIONS_FILE = get_settings_manager().resolve_runtime_path("positions_file", DATA_DIR / "positions.json")
ORDERS_FILE = get_settings_manager().resolve_runtime_path("orders_file", DATA_DIR / "orders.json")
WATCHLIST_FILE = get_settings_manager().resolve_runtime_path("watchlist_file", DATA_DIR / "watchlist.json")

# Global singleton config repository (thread-safe)
_config_repository: Optional[ConfigRepository] = None
_config_repository_lock = threading.Lock()
_agent_runtime: Optional[AgentRuntime] = None
_agent_runtime_lock = threading.Lock()


def get_positions_path() -> Path:
    """Get path to positions.json."""
    return POSITIONS_FILE


def get_orders_path() -> Path:
    """Get path to orders.json."""
    return ORDERS_FILE


def get_watchlist_path() -> Path:
    """Get path to watchlist.json."""
    return WATCHLIST_FILE


def get_orders_repo() -> OrdersRepository:
    path = get_orders_path()
    if not path.exists():
        from api.utils.file_lock import locked_write_json
        locked_write_json(path, {"asof": get_today_str(), "orders": []})
    return OrdersRepository(path)


def get_positions_repo() -> PositionsRepository:
    path = get_positions_path()
    if not path.exists():
        from api.utils.file_lock import locked_write_json
        locked_write_json(path, {"asof": get_today_str(), "positions": []})
    return PositionsRepository(path)


def get_watchlist_repo() -> WatchlistRepository:
    return WatchlistRepository(get_watchlist_path())


def get_strategy_repo() -> StrategyRepository:
    return StrategyRepository()


def get_intelligence_config_repo() -> IntelligenceConfigRepository:
    return IntelligenceConfigRepository()


def get_fundamentals_config_repo() -> FundamentalsConfigRepository:
    return FundamentalsConfigRepository()


def get_intelligence_symbol_sets_repo() -> IntelligenceSymbolSetsRepository:
    return IntelligenceSymbolSetsRepository()


def get_intelligence_config_service(
    strategy_repo: StrategyRepository = Depends(get_strategy_repo),
    config_repo: IntelligenceConfigRepository = Depends(get_intelligence_config_repo),
    symbol_sets_repo: IntelligenceSymbolSetsRepository = Depends(get_intelligence_symbol_sets_repo),
) -> IntelligenceConfigService:
    return IntelligenceConfigService(
        strategy_repo=strategy_repo,
        config_repo=config_repo,
        symbol_sets_repo=symbol_sets_repo,
    )


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
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
) -> ScreenerService:
    return ScreenerService(strategy_repo=strategy_repo, portfolio_service=portfolio_service)


def get_intelligence_service(
    strategy_repo: StrategyRepository = Depends(get_strategy_repo),
    config_service: IntelligenceConfigService = Depends(get_intelligence_config_service),
) -> IntelligenceService:
    return IntelligenceService(strategy_repo=strategy_repo, config_service=config_service)


def get_fundamentals_service(
    config_repo: FundamentalsConfigRepository = Depends(get_fundamentals_config_repo),
    watchlist_repo: WatchlistRepository = Depends(get_watchlist_repo),
) -> FundamentalsService:
    return FundamentalsService(config_repo=config_repo, watchlist_repo=watchlist_repo)


def get_workspace_context_service(
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
    strategy_service: StrategyService = Depends(get_strategy_service),
    intelligence_service: IntelligenceService = Depends(get_intelligence_service),
) -> WorkspaceContextService:
    return WorkspaceContextService(
        portfolio_service=portfolio_service,
        strategy_service=strategy_service,
        intelligence_service=intelligence_service,
    )


def get_chat_service(
    workspace_context_service: WorkspaceContextService = Depends(get_workspace_context_service),
    config_service: IntelligenceConfigService = Depends(get_intelligence_config_service),
) -> ChatService:
    return ChatService(
        workspace_context_service=workspace_context_service,
        config_service=config_service,
    )


def get_agent_chat_service() -> AgentChatService:
    return AgentChatService(runtime=get_agent_runtime())


def get_agent_runtime() -> AgentRuntime:
    global _agent_runtime
    if _agent_runtime is None:
        with _agent_runtime_lock:
            if _agent_runtime is None:
                _agent_runtime = AgentRuntime()
    return _agent_runtime


async def shutdown_agent_runtime() -> None:
    global _agent_runtime
    runtime = _agent_runtime
    _agent_runtime = None
    if runtime is not None:
        await runtime.shutdown()
