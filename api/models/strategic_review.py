from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


RiskMode = Literal["normal", "defensive", "aggressive"]


class StrategicReviewRequest(BaseModel):
    ticker: str = Field(min_length=1)
    topic: str | None = None
    refresh_sources: bool = Field(
        default=False,
        description="When true, refresh configured app evidence sources before building the overlay.",
    )
    risk_mode: RiskMode = "normal"
    horizon_days: int = Field(default=10, gt=0, le=90)

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("topic")
    @classmethod
    def normalize_topic(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = value.strip()
        return text or None
