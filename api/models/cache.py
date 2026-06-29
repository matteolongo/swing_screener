"""Pydantic response models for the Cache management API."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel


class CacheStatusEntry(BaseModel):
    id: str
    label: str
    storage: Literal["disk_json", "disk_parquet", "memory"]
    ttl_description: str
    can_clear: bool
    last_modified_at: Optional[str] = None  # ISO8601
    entry_count: Optional[int] = None


class CacheClearResponse(BaseModel):
    cleared: bool
    cache_id: str
