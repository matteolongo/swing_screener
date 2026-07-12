from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

from api.main import app
from api.dependencies import get_fundamentals_service, get_portfolio_service, get_positions_repo
from swing_screener.intelligence.models import SymbolIntelligence
from api.models.portfolio import PositionUpdate, PositionWithMetrics


class _Fund:
    def get_snapshot(self, symbol):
        return SimpleNamespace(
            sector="Tech", trailing_pe=20.0, revenue_growth_yoy=0.15, gross_margin=0.44,
            net_margin=0.22, return_on_equity=0.31, debt_to_equity=0.7,
            insider_net_shares_90d=-500, insider_transaction_count_90d=4,
            forward_eps_estimate=2.05, analyst_upgrade_downgrade_net_30d=2,
        )


class _Port:
    def __init__(self, position=None, *, technicals_raise=False):
        self.position = position
        self.technicals_raise = technicals_raise

    def get_earnings_proximity(self, ticker):
        return SimpleNamespace(days_until=5, next_earnings_date="2026-06-20")

    def list_positions(self, status=None, **_kwargs):
        return SimpleNamespace(positions=[self.position] if self.position is not None else [])

    def suggest_position_stop(self, position_id):
        return PositionUpdate(
            ticker="AAPL",
            status="open",
            last=101.0,
            entry=100.0,
            stop_old=95.0,
            stop_suggested=98.0,
            shares=10,
            r_now=0.2,
            action="MOVE_STOP_UP",
            reason="trail",
        )

    def fetch_recent_ohlcv(self, ticker):
        if self.technicals_raise:
            raise RuntimeError("ohlcv provider down")
        return []


class _Repo:
    def list_positions(self, status=None):
        return [], None


def test_analyze_enriches_request_before_calling_llm(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    captured = {}

    def _fake_analyze(self, ticker, req, past_positions=None, recorder=None):
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

    analyzer_instance = type(
        "_FakeAnalyzer",
        (),
        {"analyze": _fake_analyze, "context_fingerprint": lambda self, *a: "test"},
    )()

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


def test_position_analysis_trace_records_nonfatal_technical_enrichment_failure(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    captured = {}
    position = PositionWithMetrics(
        ticker="AAPL",
        status="open",
        entry_date="2026-06-01",
        entry_price=100.0,
        stop_price=95.0,
        shares=10,
        position_id="pos-aapl",
        initial_risk=5.0,
        max_favorable_price=104.0,
        current_price=101.0,
        notes="",
        thesis="Hold while trend holds.",
        tags=[],
        partial_closes=[],
        trail_method="sma20",
        trail_param=None,
        pnl=10.0,
        fees_eur=0.0,
        pnl_percent=1.0,
        r_now=0.2,
        entry_value=1000.0,
        current_value=1010.0,
        per_share_risk=5.0,
        total_risk=50.0,
        days_open=30,
        time_stop_warning=False,
        price_source="live",
        r_uses_initial_risk=False,
    )

    def _fake_analyze(self, ticker, req, past_positions=None, recorder=None):
        technical_step = next(s for s in recorder.trace.steps if s.name == "enrich_technicals")
        captured["technical_summary"] = technical_step.outputs_summary
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

    analyzer_instance = type(
        "_FakeAnalyzer",
        (),
        {"analyze": _fake_analyze, "context_fingerprint": lambda self, *a: "test"},
    )()

    app.dependency_overrides[get_fundamentals_service] = lambda: _Fund()
    app.dependency_overrides[get_portfolio_service] = lambda: _Port(
        position, technicals_raise=True
    )
    try:
        with (
            patch("api.routers.intelligence._get_analyzer", return_value=analyzer_instance),
            patch("api.routers.intelligence.read_from_cache", return_value=None),
            patch("api.routers.intelligence.enrich_with_polygon_prices", side_effect=lambda _t, req: req),
        ):
            client = TestClient(app)
            resp = client.post("/api/intelligence/position/pos-aapl")
        assert resp.status_code == 200, resp.text
        assert captured["technical_summary"]["ohlcv_rows"] == 0
        assert captured["technical_summary"]["skipped_reason"] == "RuntimeError: ohlcv provider down"
    finally:
        app.dependency_overrides.clear()
