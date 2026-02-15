"""Market intelligence configuration and domain helpers."""

from .config import (
    CatalystConfig,
    IntelligenceConfig,
    OpportunityConfig,
    ThemeConfig,
    build_intelligence_config,
)
from .ingestion import collect_events
from .models import CatalystSignal, Event, Opportunity, SymbolState, ThemeCluster
from .reaction import ReactionMetrics, build_catalyst_signals, evaluate_event_reaction
from .storage import IntelligenceStorage

__all__ = [
    "CatalystConfig",
    "CatalystSignal",
    "Event",
    "IntelligenceConfig",
    "IntelligenceStorage",
    "Opportunity",
    "OpportunityConfig",
    "SymbolState",
    "ThemeConfig",
    "ThemeCluster",
    "build_intelligence_config",
    "build_catalyst_signals",
    "collect_events",
    "evaluate_event_reaction",
    "ReactionMetrics",
]
