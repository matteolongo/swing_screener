"""Execution provider abstractions for broker-backed orders and positions."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal, Optional


ExecutionOrderStatus = Literal["pending", "filled", "cancelled"]
ExecutionOrderSide = Literal["buy", "sell"]
ExecutionOrderType = Literal["market", "limit", "stop", "stop_limit"]
ExecutionTimeInForce = Literal["day", "gtc", "ioc", "fok", "opg", "cls"]


@dataclass(frozen=True)
class ExecutionOrder:
    """Normalized broker order model used by the API service layer."""

    order_id: str
    ticker: str
    status: ExecutionOrderStatus
    side: ExecutionOrderSide
    order_type: ExecutionOrderType
    quantity: float
    filled_quantity: float = 0.0
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None
    tif: str = "gtc"
    submitted_at: Optional[str] = None
    filled_at: Optional[str] = None
    avg_fill_price: Optional[float] = None
    client_order_id: Optional[str] = None
    raw_status: Optional[str] = None


@dataclass(frozen=True)
class ExecutionPosition:
    """Normalized broker position model used by the API service layer."""

    ticker: str
    quantity: float
    avg_entry_price: float
    current_price: Optional[float] = None
    market_value: Optional[float] = None
    unrealized_pl: Optional[float] = None


@dataclass(frozen=True)
class SubmitOrderRequest:
    """Provider-agnostic order submission payload."""

    ticker: str
    side: ExecutionOrderSide
    order_type: ExecutionOrderType
    quantity: float
    tif: ExecutionTimeInForce = "gtc"
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None
    client_order_id: Optional[str] = None


class ExecutionProvider(ABC):
    """Abstract interface for broker execution providers."""

    @abstractmethod
    def get_provider_name(self) -> str:
        """Return provider identifier (e.g. 'alpaca-paper')."""

    @abstractmethod
    def list_orders(
        self,
        status: Optional[ExecutionOrderStatus] = None,
        ticker: Optional[str] = None,
    ) -> list[ExecutionOrder]:
        """List broker orders."""

    @abstractmethod
    def get_order(self, order_id: str) -> ExecutionOrder:
        """Get a single broker order by broker order id."""

    @abstractmethod
    def submit_order(self, request: SubmitOrderRequest) -> ExecutionOrder:
        """Submit an order to the broker."""

    @abstractmethod
    def cancel_order(self, order_id: str) -> None:
        """Cancel a broker order by id."""

    @abstractmethod
    def list_positions(self) -> list[ExecutionPosition]:
        """List currently open positions from broker."""

    @abstractmethod
    def get_open_position(self, ticker: str) -> Optional[ExecutionPosition]:
        """Get one open position by ticker, if present."""

