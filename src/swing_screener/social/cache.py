from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Iterable, Optional

from swing_screener.social.models import SocialRawEvent, SocialDailyMetrics


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class SocialCache:
    base_dir: Path | None = None

    def _root(self) -> Path:
        return self.base_dir or (_repo_root() / "data" / "social_cache")

    def _events_path(self, provider: str, day: date) -> Path:
        return self._root() / "events" / provider / f"{day.isoformat()}.json"

    def _metrics_path(self, day: date) -> Path:
        return self._root() / "metrics" / f"{day.isoformat()}.json"

    def _ensure_parent(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)

    def get_events(
        self, provider: str, day: date, symbols: Iterable[str] | None = None
    ) -> Optional[list[SocialRawEvent]]:
        path = self._events_path(provider, day)
        if not path.exists():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        events = [SocialRawEvent.model_validate(item) for item in data]
        if symbols:
            symbol_set = {str(s).upper() for s in symbols}
            events = [ev for ev in events if ev.symbol.upper() in symbol_set]
        return events

    def store_events(self, provider: str, day: date, events: list[SocialRawEvent]) -> None:
        path = self._events_path(provider, day)
        self._ensure_parent(path)
        payload = [e.model_dump(mode="json") for e in events]
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def get_metrics(self, day: date) -> Optional[list[SocialDailyMetrics]]:
        path = self._metrics_path(day)
        if not path.exists():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        return [SocialDailyMetrics.model_validate(item) for item in data]

    def store_metrics(self, day: date, metrics: list[SocialDailyMetrics]) -> None:
        path = self._metrics_path(day)
        self._ensure_parent(path)
        payload = [m.model_dump(mode="json") for m in metrics]
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def get_attention_history(self, symbol: str, asof: date, lookback_days: int) -> list[float]:
        symbol = symbol.upper()
        values: list[float] = []
        for offset in range(1, lookback_days + 1):
            day = asof - timedelta(days=offset)
            metrics = self.get_metrics(day)
            if not metrics:
                continue
            for m in metrics:
                if m.symbol.upper() == symbol:
                    values.append(float(m.attention_score))
                    break
        return values

    def get_hype_history(self, symbol: str, asof: date, lookback_days: int) -> list[float]:
        symbol = symbol.upper()
        values: list[float] = []
        for offset in range(1, lookback_days + 1):
            day = asof - timedelta(days=offset)
            metrics = self.get_metrics(day)
            if not metrics:
                continue
            for m in metrics:
                if m.symbol.upper() == symbol and m.hype_score is not None:
                    values.append(float(m.hype_score))
                    break
        return values
