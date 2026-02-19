"""Authentication router."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import (
    get_auth_mode,
    get_auth_service,
    get_current_user,
    get_managed_auth_service,
    is_auth_enabled,
)
from api.models.auth import AuthUser, LoginRequest, LoginResponse, ManagedTokenExchangeRequest
from api.services.auth_service import AuthService
from api.services.managed_auth_service import ManagedAuthService

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Authenticate a user from CSV credentials and return a bearer token."""
    if not is_auth_enabled():
        raise HTTPException(status_code=503, detail="Authentication is disabled")
    if get_auth_mode() != "csv":
        raise HTTPException(status_code=400, detail="CSV login is disabled in managed auth mode")
    return auth_service.login(email=request.email, password=request.password)


@router.post("/exchange", response_model=LoginResponse)
async def exchange_provider_token(
    request: ManagedTokenExchangeRequest,
    managed_auth_service: ManagedAuthService = Depends(get_managed_auth_service),
):
    """Validate provider token and exchange it for an app bearer token."""
    if not is_auth_enabled():
        raise HTTPException(status_code=503, detail="Authentication is disabled")
    if get_auth_mode() != "managed":
        raise HTTPException(status_code=400, detail="Managed auth exchange is disabled in CSV mode")
    return managed_auth_service.exchange_provider_token(request.provider_token)


@router.get("/me", response_model=AuthUser)
async def me(current_user: AuthUser = Depends(get_current_user)):
    """Return current authenticated user context."""
    return current_user
