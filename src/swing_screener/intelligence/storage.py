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
from swing_screener.utils.file_lock import (
    locked_read_json_cli,
    locked_write_json_cli,
    locked_write_text_cli,
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

    def education_path(self, asof: date | str) -> Path:
        return self._daily_path("education", asof)

    @property
    def symbol_state_path(self) -> Path:
        return self.root_dir / "symbol_state.json"

    def write_events(self, events: Iterable[Event], asof: date | str) -> Path:
        path = self.events_path(asof)
        lines = [json.dumps(asdict(event), sort_keys=True) for event in events]
        payload = "\n".join(lines)
        if payload:
            payload += "\n"
        locked_write_text_cli(path, payload)
        return path

    def write_signals(self, signals: Iterable[CatalystSignal], asof: date | str) -> Path:
        path = self.signals_path(asof)
        payload = [asdict(signal) for signal in signals]
        locked_write_json_cli(path, payload)
        return path

    def write_themes(self, themes: Iterable[ThemeCluster], asof: date | str) -> Path:
        path = self.themes_path(asof)
        payload = [asdict(theme) for theme in themes]
        locked_write_json_cli(path, payload)
        return path

    def write_opportunities(self, opportunities: Iterable[Opportunity], asof: date | str) -> Path:
        path = self.opportunities_path(asof)
        payload = [asdict(opportunity) for opportunity in opportunities]
        locked_write_json_cli(path, payload)
        return path

    def load_events(
        self,
        asof_date: date | str,
        *,
        symbols: list[str] | tuple[str, ...] | None = None,
        limit: int | None = None,
    ) -> list[Event]:
        path = self.events_path(asof_date)
        if not path.exists():
            return []
        symbol_set = {
            str(symbol).strip().upper()
            for symbol in (symbols or [])
            if str(symbol).strip()
        }
        out: list[Event] = []
        try:
            raw = path.read_text(encoding="utf-8")
        except Exception:
            return []
        for line in raw.splitlines():
            text = line.strip()
            if not text:
                continue
            try:
                item = json.loads(text)
            except Exception:
                continue
            if not isinstance(item, dict):
                continue
            symbol = str(item.get("symbol", "")).strip().upper()
            if symbol_set and symbol not in symbol_set:
                continue
            metadata_raw = item.get("metadata") if isinstance(item.get("metadata"), dict) else {}
            metadata: dict[str, str | float | int | bool] = {}
            if isinstance(metadata_raw, dict):
                for key, value in metadata_raw.items():
                    if isinstance(value, (str, float, int, bool)):
                        metadata[str(key)] = value
            out.append(
                Event(
                    event_id=str(item.get("event_id", "")),
                    symbol=symbol,
                    source=str(item.get("source", "")),
                    occurred_at=str(item.get("occurred_at", "")),
                    headline=str(item.get("headline", "")),
                    event_type=str(item.get("event_type", "news")),
                    credibility=float(item.get("credibility", 0.0)),
                    url=str(item.get("url")) if item.get("url") else None,
                    metadata=metadata,
                )
            )
            if limit is not None and len(out) >= max(1, int(limit)):
                break
        return out

    def load_signals(
        self,
        asof_date: date | str,
        *,
        symbols: list[str] | tuple[str, ...] | None = None,
    ) -> list[CatalystSignal]:
        path = self.signals_path(asof_date)
        if not path.exists():
            return []
        symbol_set = {
            str(symbol).strip().upper()
            for symbol in (symbols or [])
            if str(symbol).strip()
        }
        try:
            payload = locked_read_json_cli(path)
        except Exception:
            return []
        if not isinstance(payload, list):
            return []
        out: list[CatalystSignal] = []
        for item in payload:
            if not isinstance(item, dict):
                continue
            symbol = str(item.get("symbol", "")).strip().upper()
            if not symbol:
                continue
            if symbol_set and symbol not in symbol_set:
                continue
            out.append(
                CatalystSignal(
                    symbol=symbol,
                    event_id=str(item.get("event_id", "")),
                    return_z=float(item.get("return_z", 0.0)),
                    atr_shock=float(item.get("atr_shock", 0.0)),
                    peer_confirmation_count=int(item.get("peer_confirmation_count", 0)),
                    recency_hours=float(item.get("recency_hours", 0.0)),
                    is_false_catalyst=bool(item.get("is_false_catalyst", False)),
                    reasons=[str(value) for value in item.get("reasons", []) if str(value)],
                )
            )
        out.sort(key=lambda signal: signal.recency_hours)
        return out

    def load_opportunities(self, asof: date | str) -> list[Opportunity]:
        path = self.opportunities_path(asof)
        if not path.exists():
            return []
        try:
            payload = locked_read_json_cli(path)
        except Exception:
            return []
        if not isinstance(payload, list):
            return []
        out: list[Opportunity] = []
        for item in payload:
            if not isinstance(item, dict):
                continue
            symbol = str(item.get("symbol", "")).strip().upper()
            state = str(item.get("state", "QUIET")).strip().upper()
            if not symbol:
                continue
            out.append(
                Opportunity(
                    symbol=symbol,
                    technical_readiness=float(item.get("technical_readiness", 0.0)),
                    catalyst_strength=float(item.get("catalyst_strength", 0.0)),
                    opportunity_score=float(item.get("opportunity_score", 0.0)),
                    state=state if state in {"QUIET", "WATCH", "CATALYST_ACTIVE", "TRENDING", "COOLING_OFF"} else "QUIET",
                    explanations=[str(v) for v in item.get("explanations", [])],
                )
            )
        return out

    def latest_opportunities_date(self) -> str | None:
        files = sorted(self.root_dir.glob("opportunities_*.json"))
        if not files:
            return None
        latest = files[-1].stem.replace("opportunities_", "", 1)
        return latest or None

    def latest_education_date(self) -> str | None:
        files = sorted(self.root_dir.glob("education_*.json"))
        if not files:
            return None
        latest = files[-1].stem.replace("education_", "", 1)
        return latest or None

    def load_education(self, asof_date: date | str) -> dict[str, dict]:
        path = self.education_path(asof_date)
        if not path.exists():
            return {}
        try:
            payload = locked_read_json_cli(path)
        except Exception:
            return {}
        if not isinstance(payload, dict):
            return {}
        out: dict[str, dict] = {}
        for key, value in payload.items():
            symbol = str(key).strip().upper()
            if not symbol or not isinstance(value, dict):
                continue
            out[symbol] = value
        return out

    def load_symbol_education(self, asof_date: date | str, symbol: str) -> dict | None:
        symbol_norm = str(symbol).strip().upper()
        if not symbol_norm:
            return None
        payload = self.load_education(asof_date)
        record = payload.get(symbol_norm)
        return record if isinstance(record, dict) else None

    def write_symbol_education(self, asof_date: date | str, symbol: str, record: dict) -> Path:
        path = self.education_path(asof_date)
        symbol_norm = str(symbol).strip().upper()
        if not symbol_norm:
            return path
        current = self.load_education(asof_date)
        current[symbol_norm] = record
        locked_write_json_cli(path, current)
        return path

    def load_symbol_state(self) -> dict[str, SymbolState]:
        """Load symbol state with file locking to prevent race conditions during concurrent reads/writes."""
        path = self.symbol_state_path
        if not path.exists():
            return {}
        
        try:
            # Use locked read to prevent partial/invalid reads during concurrent writes
            records = locked_read_json_cli(path)
        except Exception as e:
            # If lock fails or file is empty/invalid, return empty state
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Error reading symbol_state.json: {e}")
            return {}
        
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
        """Write symbol state with file locking to prevent race conditions."""
        path = self.symbol_state_path
        payload = [asdict(s) for s in states]
        payload.sort(key=lambda item: str(item.get("symbol", "")))
        # Use locked write to prevent concurrent access issues
        locked_write_json_cli(path, payload)
        return path
