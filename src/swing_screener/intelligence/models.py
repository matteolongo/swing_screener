from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Literal

SymbolLifecycleState = Literal[
    "QUIET",
    "WATCH",
    "CATALYST_ACTIVE",
    "TRENDING",
    "COOLING_OFF",
]


@dataclass(frozen=True)
class Event:
    event_id: str
    symbol: str
    source: str
    occurred_at: str
    headline: str
    event_type: str
    credibility: float
    url: str | None = None
    metadata: dict[str, str | float | int | bool] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class CatalystSignal:
    symbol: str
    event_id: str
    return_z: float
    atr_shock: float
    peer_confirmation_count: int
    recency_hours: float
    is_false_catalyst: bool
    reasons: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class ThemeCluster:
    theme_id: str
    name: str
    symbols: list[str]
    cluster_strength: float
    driver_signals: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class Opportunity:
    symbol: str
    technical_readiness: float
    catalyst_strength: float
    opportunity_score: float
    state: SymbolLifecycleState
    explanations: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class SymbolState:
    symbol: str
    state: SymbolLifecycleState
    last_transition_at: str
    state_score: float
    last_event_id: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def new(cls, symbol: str, state: SymbolLifecycleState = "QUIET") -> "SymbolState":
        return cls(
            symbol=symbol,
            state=state,
            last_transition_at=datetime.utcnow().isoformat(),
            state_score=0.0,
            last_event_id=None,
        )

