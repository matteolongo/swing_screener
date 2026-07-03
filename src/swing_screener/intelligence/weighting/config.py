from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from swing_screener.settings import get_settings_manager

_DEFAULT_SIGNALS = {
    "insider_activity": 10.0,
    "analyst_actions": 9.0,
    "sma_trend": 6.0,
    "momentum": 6.0,
    "relative_strength": 7.0,
    "52w_proximity": 5.0,
    "valuation": 5.0,
    "news": 4.0,
}
_DEFAULT_CATALYSTS = {
    "analyst_upgrade": 9.0,
    "analyst_downgrade": 9.0,
    "insider_buying": 10.0,
    "insider_selling": 10.0,
    "earnings_beat": 9.0,
    "earnings_miss": 9.0,
    "guidance_up": 9.0,
    "guidance_down": 9.0,
    "buyback": 8.0,
    "dividend_change": 5.0,
    "product_launch": 5.0,
    "fda_approval": 8.0,
    "acquisition": 7.0,
    "ceo_change": 4.0,
    "litigation": 6.0,
    "offering": 6.0,
    "sector_news": 7.0,
    "macro": 4.0,
    "other": 1.0,
}
_DEFAULT_UPCOMING = {
    "earnings": 6.0,
    "macro": 4.0,
    "dividend": 3.0,
    "product_launch": 5.0,
    "regulatory": 5.0,
    "other": 2.0,
}
_DEFAULT_THRESHOLDS = {
    "strongly_bullish": 20.0,
    "bullish": 6.0,
    "bearish": -6.0,
    "strongly_bearish": -20.0,
}


def _merge_defaults(defaults: dict[str, float], overrides: Any) -> dict[str, float]:
    merged = dict(defaults)
    if isinstance(overrides, dict):
        merged.update({str(key): float(value) for key, value in overrides.items()})
    return merged


@dataclass(frozen=True)
class EvidenceWeightsConfig:
    signals: dict[str, float] = field(default_factory=lambda: dict(_DEFAULT_SIGNALS))
    catalyst_types: dict[str, float] = field(
        default_factory=lambda: dict(_DEFAULT_CATALYSTS)
    )
    upcoming_event_types: dict[str, float] = field(
        default_factory=lambda: dict(_DEFAULT_UPCOMING)
    )
    balance_thresholds: dict[str, float] = field(
        default_factory=lambda: dict(_DEFAULT_THRESHOLDS)
    )

    def signal_weight(self, key: str) -> float:
        return float(self.signals.get(key, 0.0))

    def catalyst_weight(self, key: str) -> float:
        return float(self.catalyst_types.get(key, 0.0))

    def upcoming_weight(self, key: str) -> float:
        return float(self.upcoming_event_types.get(key, 0.0))


def load_evidence_weights_config() -> EvidenceWeightsConfig:
    try:
        doc = get_settings_manager().load_intelligence_document()
        cfg = doc.get("config", {}).get("evidence_weights", {}) or {}
    except Exception:
        cfg = {}

    return EvidenceWeightsConfig(
        signals=_merge_defaults(_DEFAULT_SIGNALS, cfg.get("signals")),
        catalyst_types=_merge_defaults(_DEFAULT_CATALYSTS, cfg.get("catalyst_types")),
        upcoming_event_types=_merge_defaults(
            _DEFAULT_UPCOMING, cfg.get("upcoming_event_types")
        ),
        balance_thresholds=_merge_defaults(
            _DEFAULT_THRESHOLDS, cfg.get("balance_thresholds")
        ),
    )
