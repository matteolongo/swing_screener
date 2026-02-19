"""Shared dependencies for API routers."""
from __future__ import annotations

import json
import logging
import re
import threading
from datetime import date
from pathlib import Path
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from api.models.auth import AuthUser
from api.repositories.config_repo import ConfigRepository
from api.repositories.orders_repo import OrdersRepository
from api.repositories.positions_repo import PositionsRepository
from api.repositories.strategy_repo import StrategyRepository
from api.repositories.tenant_memberships_repo import TenantMembershipRepository
from api.repositories.users_repo import UsersRepository
from api.runtime_config import load_runtime_config
from api.services.auth_service import AuthService
from api.services.backtest_service import BacktestService
from api.services.intelligence_service import IntelligenceService
from api.services.managed_auth_service import ManagedAuthService
from api.services.portfolio_service import PortfolioService
from api.services.screener_service import ScreenerService
from api.services.social_service import SocialService
from api.services.strategy_service import StrategyService

# Repository root
ROOT_DIR = Path(__file__).parent.parent.resolve()
DATA_DIR = ROOT_DIR / "data"
TENANTS_DIR = DATA_DIR / "tenants"
POSITIONS_FILE = DATA_DIR / "positions.json"
ORDERS_FILE = DATA_DIR / "orders.json"
TENANT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_bearer_scheme = HTTPBearer(auto_error=False)
_log = logging.getLogger(__name__)

# Global singleton config repositories (thread-safe)
_config_repository: Optional[ConfigRepository] = None
_tenant_config_repositories: dict[str, ConfigRepository] = {}
_config_repository_lock = threading.Lock()


def _sanitize_tenant_id(raw_tenant_id: str) -> str:
    tenant_id = str(raw_tenant_id).strip()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Missing tenant identifier")
    if not TENANT_ID_RE.fullmatch(tenant_id):
        raise HTTPException(status_code=400, detail="Invalid tenant identifier")
    return tenant_id


def _get_tenant_data_dir(tenant_id: str) -> Path:
    tenant_dir = TENANTS_DIR / tenant_id
    tenant_dir.mkdir(parents=True, exist_ok=True)
    return tenant_dir


def _bootstrap_tenant_portfolio_files(tenant_dir: Path) -> None:
    today = date.today().isoformat()
    seeds = {
        tenant_dir / "positions.json": {"asof": today, "positions": []},
        tenant_dir / "orders.json": {"asof": today, "orders": []},
    }
    for path, payload in seeds.items():
        if path.exists():
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def get_users_path() -> Path:
    """Get path to users CSV file."""
    users_path = Path(load_runtime_config().auth_users_csv_path)
    return users_path if users_path.is_absolute() else ROOT_DIR / users_path


def get_memberships_path() -> Path:
    """Get path to managed auth tenant memberships CSV."""
    memberships_path = Path(load_runtime_config().auth_memberships_csv_path)
    return memberships_path if memberships_path.is_absolute() else ROOT_DIR / memberships_path


def is_auth_enabled() -> bool:
    """Check whether auth is enabled by environment."""
    return load_runtime_config().auth_enabled


def get_auth_mode() -> str:
    """Get auth mode: csv or managed."""
    return load_runtime_config().auth_mode


def get_users_repo() -> UsersRepository:
    return UsersRepository(get_users_path())


def get_memberships_repo() -> TenantMembershipRepository:
    return TenantMembershipRepository(get_memberships_path())


def get_auth_service(
    users_repo: UsersRepository = Depends(get_users_repo),
) -> AuthService:
    runtime_config = load_runtime_config()
    return AuthService(
        users_repo=users_repo,
        jwt_secret=runtime_config.auth_jwt_secret,
        jwt_expire_minutes=runtime_config.auth_jwt_expire_minutes,
    )


def get_managed_auth_service(
    memberships_repo: TenantMembershipRepository = Depends(get_memberships_repo),
) -> ManagedAuthService:
    runtime_config = load_runtime_config()
    return ManagedAuthService(
        memberships_repo=memberships_repo,
        app_jwt_secret=runtime_config.auth_jwt_secret,
        app_jwt_expire_minutes=runtime_config.auth_jwt_expire_minutes,
        provider=runtime_config.auth_managed_provider,
        provider_jwt_secret=runtime_config.auth_managed_jwt_secret,
        subject_claim=runtime_config.auth_managed_subject_claim,
        email_claim=runtime_config.auth_managed_email_claim,
        tenant_claim=runtime_config.auth_managed_tenant_claim,
        role_claim=runtime_config.auth_managed_role_claim,
        active_claim=runtime_config.auth_managed_active_claim,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    auth_service: AuthService = Depends(get_auth_service),
    managed_auth_service: ManagedAuthService = Depends(get_managed_auth_service),
) -> AuthUser:
    if not is_auth_enabled():
        return AuthUser(email="local@dev.local", tenant_id="default", role="owner", active=True)

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Authentication required")

    token = credentials.credentials
    mode = get_auth_mode()
    if mode == "csv":
        return auth_service.verify_token(token)

    # Managed mode: accept app tokens (issued by /api/auth/exchange) and
    # provider tokens directly to support incremental client migration.
    try:
        return auth_service.verify_token(token)
    except HTTPException:
        _log.debug(
            "App token verification failed; falling back to provider token verification "
            "(client may not yet use exchanged tokens)"
        )
        return managed_auth_service.authenticate_provider_token(token)


def get_tenant_id(current_user: AuthUser = Depends(get_current_user)) -> str:
    return _sanitize_tenant_id(current_user.tenant_id)


def get_positions_path(current_user: AuthUser = Depends(get_current_user)) -> Path:
    """Get path to positions.json, tenant-scoped when auth is enabled."""
    if not is_auth_enabled():
        return POSITIONS_FILE
    tenant_id = _sanitize_tenant_id(current_user.tenant_id)
    tenant_dir = _get_tenant_data_dir(tenant_id)
    _bootstrap_tenant_portfolio_files(tenant_dir)
    return tenant_dir / "positions.json"


def get_orders_path(current_user: AuthUser = Depends(get_current_user)) -> Path:
    """Get path to orders.json, tenant-scoped when auth is enabled."""
    if not is_auth_enabled():
        return ORDERS_FILE
    tenant_id = _sanitize_tenant_id(current_user.tenant_id)
    tenant_dir = _get_tenant_data_dir(tenant_id)
    _bootstrap_tenant_portfolio_files(tenant_dir)
    return tenant_dir / "orders.json"


def get_orders_repo(orders_path: Path = Depends(get_orders_path)) -> OrdersRepository:
    return OrdersRepository(orders_path)


def get_positions_repo(positions_path: Path = Depends(get_positions_path)) -> PositionsRepository:
    return PositionsRepository(positions_path)


def get_strategy_repo(current_user: AuthUser = Depends(get_current_user)) -> StrategyRepository:
    if not is_auth_enabled():
        return StrategyRepository()
    tenant_id = _sanitize_tenant_id(current_user.tenant_id)
    tenant_dir = _get_tenant_data_dir(tenant_id)
    return StrategyRepository(data_dir=tenant_dir)


def get_config_repo(current_user: AuthUser = Depends(get_current_user)) -> ConfigRepository:
    """Get config repository, tenant-scoped when auth is enabled."""
    if is_auth_enabled():
        tenant_id = _sanitize_tenant_id(current_user.tenant_id)
        tenant_dir = _get_tenant_data_dir(tenant_id)
        _bootstrap_tenant_portfolio_files(tenant_dir)
        with _config_repository_lock:
            repo = _tenant_config_repositories.get(tenant_id)
            if repo is None:
                initial = ConfigRepository.get_defaults()
                initial.positions_file = f"data/tenants/{tenant_id}/positions.json"
                initial.orders_file = f"data/tenants/{tenant_id}/orders.json"
                repo = ConfigRepository(initial_config=initial, path=tenant_dir / "config.json")
                _tenant_config_repositories[tenant_id] = repo
            return repo

    global _config_repository
    if _config_repository is None:
        with _config_repository_lock:
            if _config_repository is None:
                _config_repository = ConfigRepository()
    return _config_repository


def get_portfolio_service(
    orders_repo: OrdersRepository = Depends(get_orders_repo),
    positions_repo: PositionsRepository = Depends(get_positions_repo),
    config_repo: ConfigRepository = Depends(get_config_repo),
) -> PortfolioService:
    return PortfolioService(
        orders_repo=orders_repo,
        positions_repo=positions_repo,
        config_repo=config_repo,
    )


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
    current_user: AuthUser = Depends(get_current_user),
) -> IntelligenceService:
    if not is_auth_enabled():
        return IntelligenceService(strategy_repo=strategy_repo)
    tenant_id = _sanitize_tenant_id(current_user.tenant_id)
    tenant_dir = _get_tenant_data_dir(tenant_id)
    return IntelligenceService(strategy_repo=strategy_repo, storage_root=tenant_dir / "intelligence")
