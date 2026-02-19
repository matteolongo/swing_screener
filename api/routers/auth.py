"""Authentication router."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_auth_service, get_current_user, is_auth_enabled
from api.models.auth import AuthUser, LoginRequest, LoginResponse
from api.services.auth_service import AuthService

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Authenticate a user from CSV credentials and return a bearer token."""
    if not is_auth_enabled():
        raise HTTPException(status_code=503, detail="Authentication is disabled")
    return auth_service.login(email=request.email, password=request.password)


@router.get("/me", response_model=AuthUser)
async def me(current_user: AuthUser = Depends(get_current_user)):
    """Return current authenticated user context."""
    return current_user

