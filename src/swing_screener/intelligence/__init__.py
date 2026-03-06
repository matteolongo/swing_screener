"""Market intelligence configuration and domain helpers."""

from .config import (
    CalendarConfig,
    CatalystConfig,
    IntelligenceConfig,
    LLMConfig,
    OpportunityConfig,
    ScoringV2Config,
    ScoringV2Weights,
    SourceRateLimitConfig,
    SourceTimeoutConfig,
    SourcesConfig,
    ThemeConfig,
    build_intelligence_config,
)
from .ingestion import collect_events
from .models import (
    CatalystFeatureVector,
    CatalystSignal,
    EvidenceRecord,
    Event,
    InstrumentProfile,
    NormalizedEvent,
    Opportunity,
    SymbolState,
    ThemeCluster,
)
from .pipeline import IntelligenceSnapshot, run_intelligence_pipeline
from .reaction import ReactionMetrics, build_catalyst_signals, evaluate_event_reaction
from .relations import (
    apply_peer_confirmation,
    detect_theme_clusters,
    load_curated_peer_map,
)
from .scoring import (
    CatalystScoreBreakdown,
    build_catalyst_score_map,
    build_catalyst_score_map_v2,
    build_opportunities,
    score_catalyst_signal,
)
from .state import StateMachinePolicy, transition_symbol_state, update_symbol_states
from .storage import IntelligenceStorage

__all__ = [
    "CatalystConfig",
    "CalendarConfig",
    "CatalystFeatureVector",
    "CatalystSignal",
    "EvidenceRecord",
    "Event",
    "IntelligenceConfig",
    "IntelligenceStorage",
    "InstrumentProfile",
    "LLMConfig",
    "NormalizedEvent",
    "Opportunity",
    "OpportunityConfig",
    "ScoringV2Config",
    "ScoringV2Weights",
    "SourceRateLimitConfig",
    "SourceTimeoutConfig",
    "SourcesConfig",
    "SymbolState",
    "ThemeConfig",
    "ThemeCluster",
    "build_intelligence_config",
    "build_catalyst_signals",
    "collect_events",
    "evaluate_event_reaction",
    "apply_peer_confirmation",
    "detect_theme_clusters",
    "load_curated_peer_map",
    "ReactionMetrics",
    "StateMachinePolicy",
    "transition_symbol_state",
    "update_symbol_states",
    "CatalystScoreBreakdown",
    "build_catalyst_score_map",
    "build_catalyst_score_map_v2",
    "build_opportunities",
    "score_catalyst_signal",
    "IntelligenceSnapshot",
    "run_intelligence_pipeline",
]
