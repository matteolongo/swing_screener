"""Watchlist JSON repository."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from api.models.watchlist import WatchItem, WatchItemUpsertRequest
from api.utils.file_lock import locked_read_json, locked_write_json


@dataclass
class WatchlistRepository:
    path: Path

    def _read_items(self) -> list[WatchItem]:
        if not self.path.exists():
            return []
        payload = locked_read_json(self.path)
        if not isinstance(payload, dict):
            return []
        raw_items = payload.get("items", [])
        if not isinstance(raw_items, list):
            return []

        items: list[WatchItem] = []
        for raw in raw_items:
            if not isinstance(raw, dict):
                continue
            try:
                items.append(WatchItem.model_validate(raw))
            except Exception:
                continue
        return items

    def _write_items(self, items: list[WatchItem]) -> None:
        ordered = sorted(items, key=lambda item: item.ticker)
        payload = {"items": [item.model_dump(mode="json") for item in ordered]}
        locked_write_json(self.path, payload)

    def list_items(self) -> list[WatchItem]:
        return self._read_items()

    def get_item(self, ticker: str) -> WatchItem | None:
        normalized = str(ticker).strip().upper()
        for item in self._read_items():
            if item.ticker == normalized:
                return item
        return None

    def upsert_item(self, ticker: str, request: WatchItemUpsertRequest) -> WatchItem:
        normalized = str(ticker).strip().upper()
        items = self._read_items()

        for item in items:
            if item.ticker == normalized:
                return item

        created = WatchItem(
            ticker=normalized,
            watched_at=datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            watch_price=request.watch_price,
            currency=request.currency,
            source=request.source,
        )
        items.append(created)
        self._write_items(items)
        return created

    def delete_item(self, ticker: str) -> bool:
        normalized = str(ticker).strip().upper()
        items = self._read_items()
        remaining = [item for item in items if item.ticker != normalized]
        if len(remaining) == len(items):
            return False
        self._write_items(remaining)
        return True

