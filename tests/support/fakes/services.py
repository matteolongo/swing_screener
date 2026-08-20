"""Configurable service stubs for API tests."""

from __future__ import annotations


class PortfolioServiceStub:
    def __init__(
        self,
        *,
        positions: list[object] | None = None,
        orders: list[object] | None = None,
        stop_suggestions: dict[str, object] | None = None,
    ) -> None:
        self.positions = list(positions or [])
        self.orders = list(orders or [])
        self.stop_suggestions = dict(stop_suggestions or {})

    def list_positions(
        self, status: str | None = None, **kwargs: object
    ) -> list[object]:
        if status is None:
            return list(self.positions)
        return [
            position
            for position in self.positions
            if getattr(position, "status", None) == status
        ]

    def list_orders(
        self,
        status: str | None = None,
        ticker: str | None = None,
        **kwargs: object,
    ) -> list[object]:
        result = self.orders
        if status is not None:
            result = [
                order for order in result if getattr(order, "status", None) == status
            ]
        if ticker is not None:
            result = [
                order for order in result if getattr(order, "ticker", None) == ticker
            ]
        return list(result)

    def suggest_position_stop(self, position_id: str) -> object:
        if position_id not in self.stop_suggestions:
            raise KeyError(f"no stop suggestion configured for {position_id}")
        return self.stop_suggestions[position_id]


class RecordingServiceStub:
    calls: list[tuple[str, dict[str, object]]]

    def __init__(self) -> None:
        self.calls = []

    def record(self, method: str, **kwargs: object) -> None:
        self.calls.append((method, dict(kwargs)))


__all__ = ["PortfolioServiceStub", "RecordingServiceStub"]
