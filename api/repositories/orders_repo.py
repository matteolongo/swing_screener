"""Order JSON repository."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from api.utils.files import read_json_file, write_json_file, get_today_str


@dataclass
class OrdersRepository:
    path: Path

    def read(self) -> dict:
        return read_json_file(self.path)

    def write(self, data: dict) -> None:
        write_json_file(self.path, data)

    def list_orders(self, status: Optional[str] = None, ticker: Optional[str] = None) -> tuple[list[dict], str]:
        data = self.read()
        orders = data.get("orders", [])
        if status:
            orders = [o for o in orders if o.get("status") == status]
        if ticker:
            orders = [o for o in orders if o.get("ticker", "").upper() == ticker.upper()]
        return orders, data.get("asof", get_today_str())

    def get_order(self, order_id: str) -> dict | None:
        data = self.read()
        for order in data.get("orders", []):
            if order.get("order_id") == order_id:
                return order
        return None
