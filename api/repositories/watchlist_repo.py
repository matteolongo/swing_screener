"""Watchlist JSON repository."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from api.models.watchlist import WatchItem, WatchItemUpsertRequest
from api.utils.file_lock import locked_read_json, locked_read_modify_write, locked_write_json


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

    def list_items(self) -> list[WatchItem]:
        return self._read_items()

    def get_item(self, ticker: str) -> WatchItem | None:
        normalized = str(ticker).strip().upper()
        for item in self._read_items():
            if item.ticker == normalized:
                return item
        return None

    def _atomic_update(self, mutate) -> None:
        """Apply mutate(list_of_raw_items) under one exclusive lock, re-sorted on write."""
        def _modify(payload: dict) -> dict:
            raw = payload.get("items", [])
            if not isinstance(raw, list):
                raw = []
            mutate(raw)
            payload["items"] = sorted(raw, key=lambda i: str(i.get("ticker", "")))
            return payload

        if not self.path.exists():
            locked_write_json(self.path, {"items": []})
        locked_read_modify_write(self.path, _modify)

    def upsert_item(self, ticker: str, request: WatchItemUpsertRequest) -> WatchItem:
        normalized = str(ticker).strip().upper()

        existing = self.get_item(normalized)
        if existing is not None:
            return existing

        created = WatchItem(
            ticker=normalized,
            watched_at=datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            watch_price=request.watch_price,
            currency=request.currency,
            source=request.source,
        )

        def mutate(raw: list) -> None:
            if any(str(i.get("ticker", "")).upper() == normalized for i in raw):
                return
            raw.append(created.model_dump(mode="json"))

        self._atomic_update(mutate)
        return created

    def delete_item(self, ticker: str) -> bool:
        normalized = str(ticker).strip().upper()
        removed = {"any": False}

        def mutate(raw: list) -> None:
            before = len(raw)
            raw[:] = [i for i in raw if str(i.get("ticker", "")).upper() != normalized]
            removed["any"] = len(raw) != before

        self._atomic_update(mutate)
        return removed["any"]

