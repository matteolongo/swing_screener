from __future__ import annotations

import pytest
from pydantic import ValidationError

from swing_screener.intelligence.strategic.agent import StrategicIntelligenceAgent
from swing_screener.intelligence.strategic.models import (
    MarketContext,
    OpenPositionContext,
    StrategicAction,
    StrategicIntelligenceRequest,
    StrategicSignal,
    WatchedSymbolContext,
)


def test_strategic_action_rejects_execution_language():
    with pytest.raises(ValidationError):
        StrategicAction(
            action_type="BUY_NOW",
            title="Buy the breakout",
            rationale="Execution action should not be allowed in strategic overlay.",
        )


def test_agent_clusters_related_context_into_advisory_situation():
    request = StrategicIntelligenceRequest(
        topic="AI infrastructure supply chain",
        signals=[
            StrategicSignal(
                title="Hyperscaler AI capex accelerates again",
                summary="Cloud platforms are raising AI infrastructure budgets.",
                source="app.curated",
                timestamp="2026-07-03T08:00:00Z",
                symbols=["NVDA", "ASML"],
                tags=["semiconductors", "ai_capex"],
                confidence=0.85,
            ),
            StrategicSignal(
                title="Export controls pressure advanced semiconductor equipment",
                summary="Policy risk remains elevated for advanced chip equipment.",
                source="app.curated",
                timestamp="2026-07-03T09:00:00Z",
                symbols=["ASML", "AMD"],
                tags=["semiconductors", "regulation"],
                confidence=0.7,
            ),
        ],
        candidates=[
            WatchedSymbolContext(
                symbol="NVDA",
                source_bucket="screener_candidate",
                sector="Technology",
                signal="breakout",
                action="BUY_ON_PULLBACK",
                conviction="high",
                catalyst_urgency="medium",
            ),
            WatchedSymbolContext(
                symbol="ASML",
                source_bucket="watchlist",
                sector="Technology",
                signal="base breakout",
                action="WATCH",
                conviction="medium",
                catalyst_urgency="high",
            ),
        ],
        positions=[
            OpenPositionContext(
                symbol="AMD",
                sector="Technology",
                r_now=1.4,
                days_open=8,
                thesis_status="intact",
            )
        ],
        market_context=MarketContext(timeframe="daily", horizon_days=10, risk_mode="normal"),
    )

    report = StrategicIntelligenceAgent().analyze(request)

    assert report.input_policy == "app_context_only"
    assert report.situations
    situation = report.situations[0]
    assert situation.stage in {"emerging", "active"}
    assert situation.affected_symbols == ["AMD", "ASML", "NVDA"]
    assert any("AI infrastructure supply chain" in item for item in situation.why_now)
    assert situation.mechanisms
    assert situation.predictions
    assert situation.predictions[0].horizon_days == 10
    assert situation.predictions[0].invalidation
    assert {action.action_type for action in situation.actions} <= {
        "REVIEW_CONTEXT",
        "WAIT_FOR_CONFIRMATION",
        "TIGHTEN_RISK_REVIEW",
        "REDUCE_EXPOSURE_REVIEW",
    }
    assert "BUY_NOW" not in report.memo


def test_agent_builds_overlay_from_candidates_without_external_crawling():
    request = StrategicIntelligenceRequest(
        candidates=[
            WatchedSymbolContext(
                symbol="XBI",
                source_bucket="screener_candidate",
                sector="Healthcare",
                signal="sector momentum",
                action="WATCH",
                conviction="medium",
                catalyst_urgency="none",
            )
        ],
        market_context=MarketContext(timeframe="daily", horizon_days=5, risk_mode="defensive"),
    )

    report = StrategicIntelligenceAgent().analyze(request)

    assert report.external_source_count == 0
    assert report.situations[0].affected_symbols == ["XBI"]
    assert report.situations[0].actions[0].action_type == "WAIT_FOR_CONFIRMATION"
    assert "app context" in report.memo
