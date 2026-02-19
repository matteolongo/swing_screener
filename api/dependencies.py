"""Shared dependencies for API routers."""
from __future__ import annotations

import threading
from pathlib import Path
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from api.models.auth import AuthUser
from api.repositories.users_repo import UsersRepository
from api.repositories.config_repo import ConfigRepository
from api.repositories.orders_repo import OrdersRepository
from api.repositories.positions_repo import PositionsRepository
from api.repositories.strategy_repo import StrategyRepository
from api.runtime_config import load_runtime_config
from api.services.auth_service import AuthService
from api.services.backtest_service import BacktestService
from api.services.intelligence_service import IntelligenceService
from api.services.portfolio_service import PortfolioService
from api.services.screener_service import ScreenerService
from api.services.social_service import SocialService
from api.services.strategy_service import StrategyService

# Repository root
ROOT_DIR = Path(__file__).parent.parent.resolve()
DATA_DIR = ROOT_DIR / "data"
POSITIONS_FILE = DATA_DIR / "positions.json"
ORDERS_FILE = DATA_DIR / "orders.json"
_runtime_config = load_runtime_config()
_bearer_scheme = HTTPBearer(auto_error=False)

# Global singleton config repository (thread-safe)
_config_repository: Optional[ConfigRepository] = None
_config_repository_lock = threading.Lock()


def get_positions_path() -> Path:
    """Get path to positions.json."""
    return POSITIONS_FILE


def get_orders_path() -> Path:
    """Get path to orders.json."""
    return ORDERS_FILE


def get_users_path() -> Path:
    """Get path to users CSV file."""
    users_path = Path(_runtime_config.auth_users_csv_path)
    return users_path if users_path.is_absolute() else ROOT_DIR / users_path


def is_auth_enabled() -> bool:
    """Check whether auth is enabled by environment."""
    return _runtime_config.auth_enabled


def get_orders_repo() -> OrdersRepository:
    return OrdersRepository(get_orders_path())


def get_positions_repo() -> PositionsRepository:
    return PositionsRepository(get_positions_path())


def get_users_repo() -> UsersRepository:
    return UsersRepository(get_users_path())


def get_strategy_repo() -> StrategyRepository:
    return StrategyRepository()


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


def get_auth_service(
    users_repo: UsersRepository = Depends(get_users_repo),
) -> AuthService:
    return AuthService(
        users_repo=users_repo,
        jwt_secret=_runtime_config.auth_jwt_secret,
        jwt_expire_minutes=_runtime_config.auth_jwt_expire_minutes,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    auth_service: AuthService = Depends(get_auth_service),
) -> AuthUser:
    if not is_auth_enabled():
        return AuthUser(email="local@dev.local", tenant_id="default", role="owner", active=True)

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Authentication required")
    return auth_service.verify_token(credentials.credentials)


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
