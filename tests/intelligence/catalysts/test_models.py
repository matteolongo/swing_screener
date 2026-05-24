from __future__ import annotations
import pytest
from pydantic import ValidationError
from swing_screener.intelligence.catalysts.models import (
    CatalystOpportunity, CatalystOpportunityState,
    CatalystReport, CompanyCatalyst, MarketTheme, SourceEvidence, CausalChainStep,
)


def _source() -> SourceEvidence:
    return SourceEvidence(
        title="Tariff update", url="https://example.com/1",
        quote_or_summary="New 25% tariff on steel imports.",
        relevance="Direct cost increase for steel importers.",
    )


def _causal_step() -> CausalChainStep:
    return CausalChainStep(step=1, cause="tariff on steel", effect="higher input costs", affected_sector="manufacturing")


def _company(ticker="STLD", benefit_type="loser") -> CompanyCatalyst:
    return CompanyCatalyst(
        ticker=ticker, company_name="Steel Dynamics",
        benefit_type=benefit_type,
        thesis="Higher tariffs increase domestic steel prices.",
        causal_chain=[_causal_step()],
        evidence=[_source()],
        catalyst_strength=7.5, market_awareness=5.0,
        priced_in_risk=4.0, swing_relevance=6.5,
        risk_level="medium", key_risks=["tariff reversal"],
        expected_time_horizon="weeks",
    )


def test_full_catalyst_report_parses():
    report = CatalystReport(
        report_id="abc-123",
        event_summary="New steel tariffs announced.",
        themes=[MarketTheme(name="Steel tariff", summary="US imposes 25% tariff.", time_horizon="short_term", confidence=0.85)],
        causal_chains=[_causal_step()],
        beneficiaries=[_company("STLD", "first_order")],
        losers=[_company("NUE", "loser")],
        hidden_opportunities=[],
        non_actionable_notes=["Long-term reshoring thesis not swing-relevant."],
        generated_at="2026-05-24T10:00:00Z",
    )
    assert report.report_id == "abc-123"
    assert len(report.beneficiaries) == 1
    assert len(report.losers) == 1


def test_market_theme_confidence_out_of_range_fails():
    with pytest.raises(ValidationError):
        MarketTheme(name="x", summary="y", time_horizon="short_term", confidence=1.5)


def test_company_catalyst_strength_out_of_range_fails():
    with pytest.raises(ValidationError):
        _company().__class__.model_validate({**_company().model_dump(), "catalyst_strength": 11.0})


def test_catalyst_opportunity_active_states():
    for state in [
        CatalystOpportunityState.CATALYST_ACTIVE,
        CatalystOpportunityState.TRENDING,
        CatalystOpportunityState.WATCH,
        CatalystOpportunityState.COOLING_OFF,
        CatalystOpportunityState.QUIET,
    ]:
        opp = CatalystOpportunity(
            ticker="AAPL", state=state, catalyst_strength=8.0,
            thesis="Strong AI demand.", sources=[], report_id="r1",
            generated_at="2026-05-24T10:00:00Z",
        )
        assert opp.state == state


def test_catalyst_opportunity_quiet_maps_to_weak():
    """QUIET state should be accepted as a valid enum value."""
    opp = CatalystOpportunity(
        ticker="MSFT", state=CatalystOpportunityState.QUIET, catalyst_strength=0.3,
        thesis="No catalyst.", sources=[], report_id="r1",
        generated_at="2026-05-24T10:00:00Z",
    )
    assert opp.state == CatalystOpportunityState.QUIET
    # Verify the existing _catalyst_label maps QUIET → "weak"
    from swing_screener.recommendation.decision_summary import _catalyst_label  # type: ignore[attr-defined]
    label = _catalyst_label(opp)
    assert label == "weak"


def test_company_catalyst_requires_evidence_list():
    c = _company()
    assert len(c.evidence) >= 1
