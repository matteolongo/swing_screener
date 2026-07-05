from __future__ import annotations

from api.models.strategic_review import StrategicReviewRequest
from api.services.strategic_review_service import StrategicReviewService
from swing_screener.intelligence.evidence.models import SourceEvidence
from swing_screener.intelligence.models import ClassifiedCatalyst, IntelligenceEventDirection, SymbolIntelligence


def _intelligence() -> SymbolIntelligence:
    return SymbolIntelligence(
        symbol="ASML",
        generated_at="2026-07-04T10:00:00Z",
        action="MANAGE_ONLY",
        conviction="medium",
        catalyst_urgency="high",
        summary_line="AI capex supports demand, but export policy risk can interrupt follow-through.",
        narrative="Policy-sensitive demand setup.",
        inputs_used={"technical": {"sector": "Technology", "signal": "base breakout"}},
        classified_catalysts=[
            ClassifiedCatalyst(
                type="sector_news",
                direction=IntelligenceEventDirection.bullish,
                summary="AI capex supports semiconductor equipment demand.",
                source_url="https://example.com/asml-ai",
                date="2026-07-04",
            )
        ],
    )


def test_strategic_review_uses_cached_intelligence_and_refreshed_app_evidence():
    service = StrategicReviewService(
        read_intelligence_fn=lambda ticker: _intelligence() if ticker == "ASML" else None,
        collect_evidence_fn=lambda ticker: [
            SourceEvidence(
                title="Export policy update",
                url="https://example.com/export-policy",
                publisher="Example Policy",
                published_at="2026-07-04",
                quote_or_summary="New export controls add risk for semiconductor equipment suppliers.",
                relevance="regulation risk",
            )
        ]
        if ticker == "ASML"
        else [],
        now_fn=lambda: "2026-07-04T12:00:00Z",
    )

    report = service.review(
        StrategicReviewRequest(
            ticker="asml",
            topic="AI capex versus export controls",
            refresh_sources=True,
            risk_mode="defensive",
            horizon_days=7,
        )
    )

    assert report.generated_at == "2026-07-04T12:00:00Z"
    assert report.input_policy == "app_context_only"
    assert report.external_source_count == 1
    situation = report.situations[0]
    assert situation.title == "AI capex versus export controls"
    assert situation.affected_symbols == ["ASML"]
    assert situation.predictions[0].horizon_days == 7
    assert situation.predictions[0].direction in {"bullish", "mixed"}
    assert {action.action_type for action in situation.actions} >= {
        "REVIEW_CONTEXT",
        "WAIT_FOR_CONFIRMATION",
    }
    assert "ASML" in report.memo


def test_strategic_review_returns_watch_only_report_without_cached_analysis():
    service = StrategicReviewService(
        read_intelligence_fn=lambda _ticker: None,
        collect_evidence_fn=lambda _ticker: [],
        now_fn=lambda: "2026-07-04T12:00:00Z",
    )

    report = service.review(
        StrategicReviewRequest(ticker="mnst", refresh_sources=False, horizon_days=5)
    )

    assert report.external_source_count == 0
    assert report.situations[0].affected_symbols == ["MNST"]
    assert report.situations[0].actions[0].action_type == "WAIT_FOR_CONFIRMATION"
    assert "app context" in report.memo
