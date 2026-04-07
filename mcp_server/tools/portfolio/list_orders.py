"""List orders tool — reads live from DeGiro API."""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.portfolio._common import logger


class ListOrdersTool(BaseTool):
    """List live orders from DeGiro (read-only)."""

    @property
    def feature(self) -> str:
        return "portfolio"

    @property
    def name(self) -> str:
        return "list_orders"

    @property
    def description(self) -> str:
        return (
            "List current orders from DeGiro (read-only live feed). "
            "Returns 503 if DeGiro integration is not configured."
        )

    @property
    def input_schema(self) -> dict[str, Any]:
        return {"type": "object", "properties": {}}

    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        try:
            from swing_screener.integrations.degiro.credentials import load_credentials
            from swing_screener.integrations.degiro.client import DegiroClient
            from api.services.portfolio_service import _normalize_degiro_order
            from api.utils.files import get_today_str
        except ImportError as exc:
            return {"error": str(exc), "orders": [], "asof": None}

        try:
            credentials = load_credentials()
            with DegiroClient(credentials) as client:
                raw_orders = client.get_orders()
            orders = [_normalize_degiro_order(o).__dict__ for o in
                      [_normalize_degiro_order(o) for o in raw_orders]]
            return {"orders": orders, "asof": get_today_str()}
        except Exception as exc:
            logger.error("Error listing DeGiro orders: %s", exc)
            return {"error": str(exc), "orders": [], "asof": None}
