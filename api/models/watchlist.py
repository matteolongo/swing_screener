"""Watchlist API models."""
from __future__ import annotations

import math
import re
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from api.models.screener import PriceHistoryPoint


class WatchItemUpsertRequest(BaseModel):
    watch_price: Optional[float] = Field(default=None, description="Price captured when watch is created.")
    currency: Optional[str] = Field(default=None, description="Optional quote currency for watch_price.")
    source: str = Field(min_length=1, max_length=80, description="Source context where watch was created.")

    @field_validator("watch_price")
    @classmethod
    def _validate_watch_price(cls, value: Optional[float]) -> Optional[float]:
        if value is None:
            return None
        if not math.isfinite(value):
            raise ValueError("watch_price must be finite")
        if value <= 0:
            raise ValueError("watch_price must be positive")
        return float(value)

    @field_validator("currency")
    @classmethod
    def _normalize_currency(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = str(value).strip().upper()
        return cleaned or None

    @field_validator("source")
    @classmethod
    def _normalize_source(cls, value: str) -> str:
        cleaned = str(value).strip().lower()
        if not cleaned:
            raise ValueError("source is required")
        return cleaned


class WatchItem(BaseModel):
    ticker: str = Field(min_length=1, max_length=16)
    watched_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).replace(microsecond=0).isoformat())
    watch_price: Optional[float] = None
    currency: Optional[str] = None
    source: str = Field(min_length=1, max_length=80)

    @field_validator("ticker")
    @classmethod
    def _normalize_ticker(cls, value: str) -> str:
        cleaned = str(value).strip().upper()
        if not cleaned:
            raise ValueError("ticker is required")
        if not re.fullmatch(r"[A-Z0-9][A-Z0-9.-]*", cleaned):
            raise ValueError("ticker must contain only letters, numbers, dots, or hyphens")
        return cleaned

    @field_validator("watch_price")
    @classmethod
    def _validate_watch_price(cls, value: Optional[float]) -> Optional[float]:
        return WatchItemUpsertRequest._validate_watch_price(value)

    @field_validator("currency")
    @classmethod
    def _normalize_currency(cls, value: Optional[str]) -> Optional[str]:
        return WatchItemUpsertRequest._normalize_currency(value)

    @field_validator("source")
    @classmethod
    def _normalize_source(cls, value: str) -> str:
        return WatchItemUpsertRequest._normalize_source(value)


class WatchlistItemView(WatchItem):
    current_price: Optional[float] = None
    last_bar: Optional[str] = None
    signal: Optional[str] = None
    signal_trigger_price: Optional[float] = None
    distance_to_trigger_pct: Optional[float] = None
    price_history: list[PriceHistoryPoint] = Field(default_factory=list)


class WatchlistResponse(BaseModel):
    items: list[WatchlistItemView] = Field(default_factory=list)


class WatchlistDeleteResponse(BaseModel):
    deleted: bool


class WatchlistPipelineItem(BaseModel):
    ticker: str
    current_price: Optional[float] = None
    watch_price: Optional[float] = None
    signal: Optional[str] = None
    trigger_price: Optional[float] = None
    trigger_type: Optional[str] = None
    distance_pct: Optional[float] = None
    sparkline: list[float] = Field(default_factory=list)


class WatchlistPipelineResponse(BaseModel):
    items: list[WatchlistPipelineItem] = Field(default_factory=list)
