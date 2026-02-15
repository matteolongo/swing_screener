from __future__ import annotations

import hashlib
import json
from datetime import datetime
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

    def _metadata_path(self) -> Path:
        return self._root() / "metadata.json"

    def _ensure_parent(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)

    def get_events(
        self,
        provider: str,
        day: date,
        symbols: Iterable[str] | None = None,
        max_age_hours: int | None = None,
    ) -> Optional[list[SocialRawEvent]]:
        path = self._events_path(provider, day)
        if not path.exists():
            return None
        if max_age_hours is not None:
            mtime = datetime.fromtimestamp(path.stat().st_mtime)
            age_hours = (datetime.now() - mtime).total_seconds() / 3600.0
            if age_hours > max_age_hours:
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
        
        # Merge with existing events to avoid clobbering data from other symbols
        existing_events = []
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                existing_events = [SocialRawEvent.model_validate(item) for item in data]
            except (json.JSONDecodeError, ValueError):
                # If file is corrupted, start fresh
                existing_events = []
        
        # Create a dictionary keyed by (symbol, timestamp, text_hash) for deduplication
        event_dict = {}
        for ev in existing_events:
            text_hash = hashlib.sha256(ev.text.encode('utf-8')).hexdigest()[:16]
            key = (ev.symbol.upper(), ev.timestamp.isoformat(), text_hash)
            event_dict[key] = ev
        
        # Add/update with new events
        for ev in events:
            text_hash = hashlib.sha256(ev.text.encode('utf-8')).hexdigest()[:16]
            key = (ev.symbol.upper(), ev.timestamp.isoformat(), text_hash)
            event_dict[key] = ev
        
        # Write merged events back
        merged_events = sorted(event_dict.values(), key=lambda e: e.timestamp, reverse=True)
        payload = [e.model_dump(mode="json") for e in merged_events]
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

    def store_run_metadata(self, payload: dict) -> None:
        path = self._metadata_path()
        self._ensure_parent(path)
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def update_run_metadata(self, payload: dict) -> None:
        meta = self.load_run_metadata() or {}
        meta["last_run"] = payload
        self.store_run_metadata(meta)

    def update_symbol_run(self, provider: str, symbol: str, payload: dict) -> None:
        meta = self.load_run_metadata() or {}
        runs = meta.get("symbol_runs", {})
        provider_runs = runs.get(provider, {})
        provider_runs[str(symbol).upper()] = payload
        runs[provider] = provider_runs
        meta["symbol_runs"] = runs
        self.store_run_metadata(meta)

    def get_symbol_run(self, provider: str, symbol: str) -> Optional[dict]:
        meta = self.load_run_metadata() or {}
        runs = meta.get("symbol_runs", {})
        provider_runs = runs.get(provider, {})
        return provider_runs.get(str(symbol).upper())

    def load_run_metadata(self) -> Optional[dict]:
        path = self._metadata_path()
        if not path.exists():
            return None
        try:
            loaded = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError, ValueError):
            # Corrupt/partial metadata should not break request flow.
            return None
        return loaded if isinstance(loaded, dict) else None

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
