from __future__ import annotations

import json
from dataclasses import asdict
from datetime import date
from pathlib import Path
from typing import Iterable

from swing_screener.intelligence.models import (
    CatalystSignal,
    Event,
    Opportunity,
    SymbolState,
    ThemeCluster,
)


class IntelligenceStorage:
    """File-based persistence for intelligence snapshots."""

    def __init__(self, root_dir: str | Path = "data/intelligence") -> None:
        self.root_dir = Path(root_dir)
        self.root_dir.mkdir(parents=True, exist_ok=True)

    def _day_key(self, asof: date | str) -> str:
        return asof.isoformat() if isinstance(asof, date) else str(asof)

    def _daily_path(self, prefix: str, asof: date | str, suffix: str = "json") -> Path:
        return self.root_dir / f"{prefix}_{self._day_key(asof)}.{suffix}"

    def events_path(self, asof: date | str) -> Path:
        return self._daily_path("events", asof, "jsonl")

    def signals_path(self, asof: date | str) -> Path:
        return self._daily_path("signals", asof)

    def themes_path(self, asof: date | str) -> Path:
        return self._daily_path("themes", asof)

    def opportunities_path(self, asof: date | str) -> Path:
        return self._daily_path("opportunities", asof)

    @property
    def symbol_state_path(self) -> Path:
        return self.root_dir / "symbol_state.json"

    def write_events(self, events: Iterable[Event], asof: date | str) -> Path:
        path = self.events_path(asof)
        with path.open("w", encoding="utf-8") as handle:
            for event in events:
                handle.write(json.dumps(asdict(event), sort_keys=True))
                handle.write("\n")
        return path

    def write_signals(self, signals: Iterable[CatalystSignal], asof: date | str) -> Path:
        path = self.signals_path(asof)
        payload = [asdict(signal) for signal in signals]
        path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
        return path

    def write_themes(self, themes: Iterable[ThemeCluster], asof: date | str) -> Path:
        path = self.themes_path(asof)
        payload = [asdict(theme) for theme in themes]
        path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
        return path

    def write_opportunities(self, opportunities: Iterable[Opportunity], asof: date | str) -> Path:
        path = self.opportunities_path(asof)
        payload = [asdict(opportunity) for opportunity in opportunities]
        path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
        return path

    def load_symbol_state(self) -> dict[str, SymbolState]:
        path = self.symbol_state_path
        if not path.exists():
            return {}
        raw = path.read_text(encoding="utf-8").strip()
        if not raw:
            return {}
        records = json.loads(raw)
        if not isinstance(records, list):
            return {}
        state: dict[str, SymbolState] = {}
        for record in records:
            if not isinstance(record, dict):
                continue
            symbol = str(record.get("symbol", "")).strip().upper()
            status = str(record.get("state", "QUIET")).strip().upper()
            if not symbol:
                continue
            state[symbol] = SymbolState(
                symbol=symbol,
                state=status if status in {
                    "QUIET",
                    "WATCH",
                    "CATALYST_ACTIVE",
                    "TRENDING",
                    "COOLING_OFF",
                } else "QUIET",
                last_transition_at=str(record.get("last_transition_at", "")),
                state_score=float(record.get("state_score", 0.0)),
                last_event_id=(str(record.get("last_event_id")) if record.get("last_event_id") else None),
            )
        return state

    def write_symbol_state(self, states: Iterable[SymbolState]) -> Path:
        path = self.symbol_state_path
        payload = [asdict(s) for s in states]
        payload.sort(key=lambda item: str(item.get("symbol", "")))
        path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
        return path

