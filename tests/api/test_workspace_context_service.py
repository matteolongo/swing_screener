from __future__ import annotations

from types import SimpleNamespace

from api.services.workspace_context_service import WorkspaceContextService
from tests.api._chat_test_helpers import (
    make_education,
    make_event,
    make_opportunity,
    make_order,
    make_portfolio_summary,
    make_position,
    make_workspace_snapshot,
)


class FakePortfolioService:
    def __init__(self, *, orders, positions, summary):
        self._orders = orders
        self._positions = positions
        self._summary = summary

    def list_orders(self, status=None, ticker=None):
        del status, ticker
        return SimpleNamespace(orders=self._orders, asof="2026-03-13")

    def list_positions(self, status=None):
        del status
        return SimpleNamespace(positions=self._positions, asof="2026-03-13")

    def get_portfolio_summary(self, account_size):
        assert account_size == 50000.0
        return self._summary


class FakeStrategyService:
    def get_active_strategy(self):
        return {"risk": {"account_size": 50000.0}}


class FakeIntelligenceService:
    def __init__(self):
        self.requested_symbols: list[list[str] | None] = []

    def get_opportunities(self, *, asof_date, symbols=None):
        assert asof_date == "2026-03-13"
        self.requested_symbols.append(symbols)
        scope = symbols[0] if symbols else "AAPL"
        return SimpleNamespace(opportunities=[make_opportunity(scope)])

    def get_events(self, *, asof_date, symbols=None, event_types=None, min_materiality=None):
        del event_types, min_materiality
        assert asof_date == "2026-03-13"
        self.requested_symbols.append(symbols)
        scope = symbols[0] if symbols else "AAPL"
        return SimpleNamespace(events=[make_event(scope)])


class FakeStorage:
    def __init__(self, *, opportunities_date=None, education_date=None, education_payload=None):
        self._opportunities_date = opportunities_date
        self._education_date = education_date
        self._education_payload = education_payload

    def latest_opportunities_date(self):
        return self._opportunities_date

    def latest_education_date(self):
        return self._education_date

    def load_symbol_education(self, asof_date, symbol):
        assert asof_date == self._education_date
        assert symbol == "AAPL"
        return self._education_payload


def test_build_context_without_screener_snapshot_marks_screener_unloaded():
    service = WorkspaceContextService(
        portfolio_service=FakePortfolioService(
            orders=[make_order()],
            positions=[make_position()],
            summary=make_portfolio_summary(),
        ),
        strategy_service=FakeStrategyService(),
        intelligence_service=FakeIntelligenceService(),
        storage=FakeStorage(),
    )

    context = service.build_context()

    assert context.selected_ticker is None
    assert context.selected_candidate is None
    assert any(source.source == "portfolio" and source.loaded for source in context.meta.sources)
    assert any(source.source == "screener" and not source.loaded for source in context.meta.sources)
    assert "No cached intelligence snapshot is available yet." in context.warnings


def test_build_context_filters_intelligence_to_selected_ticker_and_builds_fact_map():
    intelligence_service = FakeIntelligenceService()
    service = WorkspaceContextService(
        portfolio_service=FakePortfolioService(
            orders=[make_order()],
            positions=[make_position()],
            summary=make_portfolio_summary(),
        ),
        strategy_service=FakeStrategyService(),
        intelligence_service=intelligence_service,
        storage=FakeStorage(
            opportunities_date="2026-03-13",
            education_date="2026-03-13",
            education_payload=make_education("AAPL").model_dump(mode="json"),
        ),
    )

    context = service.build_context(
        selected_ticker="aapl",
        workspace_snapshot=make_workspace_snapshot("AAPL", "MSFT"),
    )

    assert context.selected_ticker == "AAPL"
    assert context.selected_candidate is not None
    assert context.selected_candidate.ticker == "AAPL"
    assert context.intelligence is not None
    assert intelligence_service.requested_symbols == [["AAPL"], ["AAPL"]]
    assert context.fact_map["screener.selected_candidate.signal"] == "breakout"
    assert "clean continuation setup" in context.fact_map["intelligence.selected_education.thesis_summary"]
    assert any(source.source == "education" and source.loaded for source in context.meta.sources)


def test_build_context_warns_when_cached_education_is_missing():
    service = WorkspaceContextService(
        portfolio_service=FakePortfolioService(
            orders=[make_order()],
            positions=[make_position()],
            summary=make_portfolio_summary(),
        ),
        strategy_service=FakeStrategyService(),
        intelligence_service=FakeIntelligenceService(),
        storage=FakeStorage(
            opportunities_date="2026-03-13",
            education_date="2026-03-13",
            education_payload=None,
        ),
    )

    context = service.build_context(
        selected_ticker="AAPL",
        workspace_snapshot=make_workspace_snapshot("AAPL"),
    )

    assert context.intelligence is not None
    assert "No cached education is available for AAPL." in context.warnings
