from __future__ import annotations

from swing_screener.intelligence.weighting.config import (
    EvidenceWeightsConfig,
    load_evidence_weights_config,
)


def test_defaults_seed_vision_table():
    cfg = EvidenceWeightsConfig()

    assert cfg.signal_weight("insider_activity") == 10
    assert cfg.catalyst_weight("analyst_upgrade") == 9
    assert cfg.signal_weight("unknown_key") == 0.0


def test_loader_returns_config():
    cfg = load_evidence_weights_config()

    assert isinstance(cfg, EvidenceWeightsConfig)
    assert cfg.balance_thresholds["bullish"] >= cfg.balance_thresholds["bearish"]
