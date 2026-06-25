from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

from api.main import app
from api.dependencies import get_fundamentals_service, get_portfolio_service, get_positions_repo
from swing_screener.intelligence.models import SymbolIntelligence


class _Fund:
    def get_snapshot(self, symbol):
        return SimpleNamespace(
            sector="Tech", trailing_pe=20.0, revenue_growth_yoy=0.15, gross_margin=0.44,
            net_margin=0.22, return_on_equity=0.31, debt_to_equity=0.7,
            insider_net_shares_90d=-500, insider_transaction_count_90d=4,
            forward_eps_estimate=2.05, analyst_upgrade_downgrade_net_30d=2,
        )


class _Port:
    def get_earnings_proximity(self, ticker):
        return SimpleNamespace(days_until=5, next_earnings_date="2026-06-20")


class _Repo:
    def list_positions(self, status=None):
        return [], None


def test_analyze_enriches_request_before_calling_llm(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    captured = {}

    def _fake_analyze(self, ticker, req, past_positions=None):
        captured["req"] = req
        return SymbolIntelligence(
            symbol=ticker,
            generated_at="2026-06-15T00:00:00Z",
            action="WATCH",
            conviction="medium",
            catalyst_urgency="none",
            summary_line="x",
            narrative="y",
            upcoming_events=[],
            position_signal=None,
            position_outlook=None,
            sources=[],
            inputs_used={},
            price_hook=None,
            key_numbers=[],
            risk_factors=[],
            prediction_bullets=[],
            past_trades_context=None,
        )

    analyzer_instance = type("_FakeAnalyzer", (), {"analyze": _fake_analyze})()

    app.dependency_overrides[get_fundamentals_service] = lambda: _Fund()
    app.dependency_overrides[get_portfolio_service] = lambda: _Port()
    app.dependency_overrides[get_positions_repo] = lambda: _Repo()
    try:
        with (
            patch("api.routers.intelligence._get_analyzer", return_value=analyzer_instance),
            patch("api.routers.intelligence.read_from_cache", return_value=None),
        ):
            client = TestClient(app)
            resp = client.post("/api/intelligence/AAPL", json={"close": 100.0, "signal": "breakout"})
        assert resp.status_code == 200, resp.text
        assert captured["req"].trailing_pe == 20.0
        assert captured["req"].forward_eps_estimate == 2.05
        assert captured["req"].days_to_earnings == 5
    finally:
        app.dependency_overrides.clear()
