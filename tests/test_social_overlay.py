from datetime import date, datetime, timedelta

import pandas as pd
import pytest

from swing_screener.social.cache import SocialCache
from swing_screener.social.config import SocialOverlayConfig
from swing_screener.social.metrics import compute_daily_metrics
from swing_screener.social.models import SocialRawEvent, SocialDailyMetrics
from swing_screener.social.overlay import (
    apply_overlay,
    REASON_ATTENTION_SPIKE,
    REASON_HYPE_CROWDING,
    REASON_NEG_SENT,
    REASON_LOW_SAMPLE,
)
from swing_screener.risk.position_sizing import RiskConfig, build_trade_plans


def _make_ohlcv(symbol: str) -> pd.DataFrame:
    idx = pd.date_range("2026-01-01", periods=30, freq="D")
    cols = pd.MultiIndex.from_product([
        ["Open", "High", "Low", "Close", "Volume"],
        [symbol],
    ])
    df = pd.DataFrame(0.0, index=idx, columns=cols)
    df[("Volume", symbol)] = 1_000_000
    return df


def test_compute_daily_metrics_attention_and_hype(tmp_path):
    cache = SocialCache(base_dir=tmp_path)
    asof = date(2026, 2, 8)

    # history: alternating 8 and 12 (mean=10, std=2)
    for i in range(1, 21):
        day = asof - timedelta(days=i)
        score = 8 if i % 2 == 0 else 12
        cache.store_metrics(
            day,
            [
                SocialDailyMetrics(
                    symbol="AAA",
                    date=day,
                    attention_score=score,
                    attention_z=None,
                    sentiment_score=0.0,
                    sentiment_confidence=0.0,
                    hype_score=1.0,
                    sample_size=int(score),
                    source_breakdown={"reddit": int(score)},
                )
            ],
        )

    events = [
        SocialRawEvent(
            source="reddit",
            symbol="AAA",
            timestamp=datetime(2026, 2, 8, 12, 0, 0),
            text="good good",
            author_id_hash=None,
        )
        for _ in range(14)
    ]

    ohlcv = _make_ohlcv("AAA")
    metrics = compute_daily_metrics(events, ["AAA"], ohlcv, asof, cache)

    assert len(metrics) == 1
    history = cache.get_attention_history("AAA", asof, 60)
    mean = sum(history) / len(history)
    var = sum((x - mean) ** 2 for x in history) / (len(history) - 1)
    expected = (14 - mean) / (var ** 0.5)
    assert metrics[0].attention_z == pytest.approx(expected, rel=1e-6)
    assert metrics[0].hype_score == 14.0


def test_overlay_rules_and_reasons(tmp_path):
    cache = SocialCache(base_dir=tmp_path)
    asof = date(2026, 2, 8)

    # hype history to compute percentile threshold
    for i in range(1, 21):
        day = asof - timedelta(days=i)
        cache.store_metrics(
            day,
            [
                SocialDailyMetrics(
                    symbol="AAA",
                    date=day,
                    attention_score=5.0,
                    attention_z=None,
                    sentiment_score=0.0,
                    sentiment_confidence=0.0,
                    hype_score=1.0,
                    sample_size=10,
                    source_breakdown={"reddit": 10},
                )
            ],
        )

    metrics = [
        SocialDailyMetrics(
            symbol="AAA",
            date=asof,
            attention_score=30.0,
            attention_z=3.5,
            sentiment_score=-0.6,
            sentiment_confidence=0.8,
            hype_score=2.0,
            sample_size=25,
            source_breakdown={"reddit": 25},
        )
    ]

    cfg = SocialOverlayConfig(enabled=True)
    decisions = apply_overlay(metrics, cfg, cache)

    assert len(decisions) == 1
    d = decisions[0]
    assert d.risk_multiplier == 0.5
    assert d.max_pos_multiplier == 0.5
    assert d.review_required is True
    assert REASON_ATTENTION_SPIKE in d.reasons
    assert REASON_HYPE_CROWDING in d.reasons
    assert REASON_NEG_SENT in d.reasons


def test_low_sample_size_no_action(tmp_path):
    cache = SocialCache(base_dir=tmp_path)
    asof = date(2026, 2, 8)
    metrics = [
        SocialDailyMetrics(
            symbol="AAA",
            date=asof,
            attention_score=1.0,
            attention_z=None,
            sentiment_score=0.0,
            sentiment_confidence=0.0,
            hype_score=None,
            sample_size=5,
            source_breakdown={"reddit": 5},
        )
    ]
    cfg = SocialOverlayConfig(enabled=True, min_sample_size=20)
    decisions = apply_overlay(metrics, cfg, cache)

    assert decisions[0].reasons == [REASON_LOW_SAMPLE]
    assert decisions[0].risk_multiplier == 1.0


def test_trade_plan_respects_risk_multiplier():
    ranked = pd.DataFrame(
        {"atr14": [1.0], "last": [10.0]},
        index=["AAA"],
    )
    signals = pd.DataFrame(
        {"last": [10.0], "signal": ["breakout"]},
        index=["AAA"],
    )
    cfg = RiskConfig(account_size=1000, risk_pct=0.02, k_atr=1.0, max_position_pct=1.0)

    base = build_trade_plans(ranked, signals, cfg)
    overlay = build_trade_plans(
        ranked,
        signals,
        cfg,
        risk_multipliers={"AAA": 0.5},
    )

    assert base.loc["AAA", "risk_amount_target"] == 20.0
    assert overlay.loc["AAA", "risk_amount_target"] == 10.0
