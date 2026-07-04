from __future__ import annotations

from swing_screener.intelligence.weighting.config import (
    _DEFAULT_SIGNALS,
    EvidenceWeightsConfig,
    _merge_defaults,
    load_evidence_weights_config,
)


def test_merge_defaults_ignores_non_numeric_override():
    """A non-numeric YAML weight must fall back to the default, not raise."""
    merged = _merge_defaults(
        _DEFAULT_SIGNALS, {"news": "high", "insider_activity": 3, "bad": None}
    )

    assert merged["news"] == _DEFAULT_SIGNALS["news"]  # kept default, no crash
    assert merged["insider_activity"] == 3.0  # valid override applied
    assert "bad" not in merged  # None override skipped, not added


def test_defaults_seed_vision_table():
    cfg = EvidenceWeightsConfig()

    assert cfg.signal_weight("insider_activity") == 10
    assert cfg.catalyst_weight("analyst_upgrade") == 9
    assert cfg.signal_weight("unknown_key") == 0.0


def test_loader_returns_config():
    cfg = load_evidence_weights_config()

    assert isinstance(cfg, EvidenceWeightsConfig)
    assert cfg.balance_thresholds["bullish"] >= cfg.balance_thresholds["bearish"]
