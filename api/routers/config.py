"""Config router - Settings CRUD."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from api.models.config import AppConfig
from api.repositories.config_repo import ConfigRepository
from api.dependencies import get_config_repo

router = APIRouter()


@router.get("", response_model=AppConfig)
async def get_config(repo: ConfigRepository = Depends(get_config_repo)):
    """Get current application configuration."""
    return repo.get()


@router.put("", response_model=AppConfig)
async def update_config(
    config: AppConfig,
    repo: ConfigRepository = Depends(get_config_repo)
):
    """Update application configuration."""
    return repo.update(config)


@router.post("/reset", response_model=AppConfig)
async def reset_config(repo: ConfigRepository = Depends(get_config_repo)):
    """Reset configuration to defaults."""
    return repo.reset()


@router.get("/defaults", response_model=AppConfig)
async def get_defaults():
    """Get default configuration."""
    return ConfigRepository.get_defaults()
