from types import SimpleNamespace

from api.services.intelligence_summary import build_intelligence_run_summary
from swing_screener.intelligence.config import IntelligenceConfig, LLMConfig


def _snapshot() -> SimpleNamespace:
    return SimpleNamespace(
        asof_date="2026-02-25",
        symbols=("AAPL", "MSFT", "NVDA"),
        events=[
            SimpleNamespace(event_type="earnings", metadata={}),
            SimpleNamespace(event_type="earnings", metadata={}),
            SimpleNamespace(event_type="guidance", metadata={}),
        ],
        opportunities=[
            SimpleNamespace(
                symbol="AAPL",
                state="TRENDING",
                opportunity_score=0.81,
                technical_readiness=0.77,
                catalyst_strength=0.84,
            ),
            SimpleNamespace(
                symbol="NVDA",
                state="CATALYST_ACTIVE",
                opportunity_score=0.79,
                technical_readiness=0.74,
                catalyst_strength=0.83,
            ),
        ],
        themes=[
            SimpleNamespace(name="AI chips", symbols=["NVDA", "AMD"], cluster_strength=0.72),
        ],
    )


def test_build_intelligence_run_summary_without_llm():
    summary = build_intelligence_run_summary(
        cfg=IntelligenceConfig(enabled=True, llm=LLMConfig(enabled=False)),
        snapshot=_snapshot(),
        llm_warnings_count=0,
    )
    assert "Scanned 3 symbols" in summary
    assert "Top setups:" in summary


def test_build_intelligence_run_summary_with_mock_llm():
    summary = build_intelligence_run_summary(
        cfg=IntelligenceConfig(enabled=True, llm=LLMConfig(enabled=True, provider="mock")),
        snapshot=_snapshot(),
        llm_warnings_count=2,
    )
    assert "LLM warnings: 2" in summary
    assert len(summary) <= 320
