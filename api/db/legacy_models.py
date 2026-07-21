"""Strict compatibility models for one-time JSON import."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class LegacyOrder(BaseModel):
    model_config = ConfigDict(extra="allow", allow_inf_nan=False)

    order_id: str
    ticker: str
    status: Literal["pending", "submitted", "filled", "cancelled"] = "pending"
    order_type: str
    order_kind: Literal["entry", "stop", "take_profit"] = "entry"
    quantity: int = Field(gt=0)
    limit_price: float | None = None
    stop_price: float | None = None
    target_price: float | None = None
    entry_price: float | None = None
    order_date: str
    filled_date: str | None = None
    position_id: str | None = None
    quote_currency: str | None = None
    account_currency: str | None = None
    approval_fx_rate: float | None = Field(default=None, gt=0)
    fill_fx_rate: float | None = Field(default=None, gt=0)
    fee_eur: float | None = Field(default=None, ge=0)

    @field_validator("order_id", "ticker", "order_type", "order_date")
    @classmethod
    def require_text(cls, value: str) -> str:
        normalized = str(value).strip()
        if not normalized:
            raise ValueError("value must not be blank")
        return normalized

    @field_validator("ticker", "order_type")
    @classmethod
    def normalize_upper(cls, value: str) -> str:
        return value.upper()

    @field_validator("filled_date", mode="before")
    @classmethod
    def blank_date_is_none(cls, value):
        return value or None

    @field_validator("fee_eur", mode="before")
    @classmethod
    def normalize_signed_fee(cls, value):
        """Convert signed legacy broker fee debits to canonical positive amounts."""
        return None if value is None else abs(float(value))


class LegacyPosition(BaseModel):
    model_config = ConfigDict(extra="allow", allow_inf_nan=False)

    position_id: str
    source_order_id: str | None = None
    ticker: str
    status: Literal["open", "closed"] = "open"
    shares: int = Field(gt=0)
    entry_date: str
    exit_date: str | None = None
    entry_price: float = Field(gt=0)
    stop_price: float = Field(gt=0)
    target_price: float | None = Field(default=None, gt=0)
    current_price: float | None = Field(default=None, gt=0)
    exit_price: float | None = Field(default=None, gt=0)
    quote_currency: str | None = None
    account_currency: str | None = None
    entry_fx_rate: float | None = Field(default=None, gt=0)
    exit_fx_rate: float | None = Field(default=None, gt=0)
    entry_fee_eur: float | None = Field(default=None, ge=0)
    exit_fee_eur: float | None = Field(default=None, ge=0)

    @field_validator("position_id", "ticker", "entry_date")
    @classmethod
    def require_text(cls, value: str) -> str:
        normalized = str(value).strip()
        if not normalized:
            raise ValueError("value must not be blank")
        return normalized

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, value: str) -> str:
        return value.upper()

    @field_validator("exit_date", mode="before")
    @classmethod
    def blank_date_is_none(cls, value):
        return value or None

    @field_validator("entry_fee_eur", "exit_fee_eur", mode="before")
    @classmethod
    def normalize_signed_fee(cls, value):
        """Convert signed legacy broker fee debits to canonical positive amounts."""
        return None if value is None else abs(float(value))
