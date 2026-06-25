from api.services.intelligence_enrichment import enrich_intelligence_request
from swing_screener.intelligence.models import SymbolIntelligenceRequest
from swing_screener.intelligence.evidence.models import SourceEvidence
from swing_screener.intelligence.symbol_analyzer import _build_user_prompt


def _ev():
    return SourceEvidence(title="Buyback", url="http://ir/x", publisher="Company IR",
                          published_at="2026-06-20", quote_or_summary="$90B", relevance="official IR release")


def test_request_has_catalyst_evidence_default_empty():
    req = SymbolIntelligenceRequest(close=100.0, signal="BUY")
    assert req.catalyst_evidence == []


def test_enrich_sets_evidence_when_empty():
    req = SymbolIntelligenceRequest(close=100.0, signal="BUY")
    out = enrich_intelligence_request("AAPL", req, evidence=lambda t: [_ev()])
    assert len(out.catalyst_evidence) == 1


def test_enrich_evidence_failure_degrades():
    req = SymbolIntelligenceRequest(close=100.0, signal="BUY")
    def boom(t):
        raise RuntimeError("x")
    out = enrich_intelligence_request("AAPL", req, evidence=boom)
    assert out.catalyst_evidence == []


def test_prompt_renders_evidence_block():
    req = SymbolIntelligenceRequest(close=100.0, signal="BUY", catalyst_evidence=[_ev()])
    prompt = _build_user_prompt("AAPL", req, past_positions=[])
    assert "Recent catalyst evidence" in prompt
    assert "http://ir/x" in prompt
    assert "Buyback" in prompt
